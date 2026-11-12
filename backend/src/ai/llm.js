/** Azure OpenAI gateway with managed identity, deterministic budgets and fallbacks. */

const { managedIdentityToken } = require('../azure/identity');

const ENDPOINT = String(process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || '';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
const MODEL = DEPLOYMENT || 'azure-openai-not-configured';
const RPS = Math.max(1, Number(process.env.LLM_RATE_LIMIT_RPS || 2));
const DAILY_TOKENS = Math.max(1, Number(process.env.LLM_RATE_LIMIT_TOKENS_PER_DAY || 50000));
const DAILY_CALLS = Math.max(1, Number(process.env.LLM_MAX_CALLS_PER_DAY || 200));
const SUBMIT = 'submit_result';
const usage = { day: today(), tokens: 0, calls: 0, cacheReadTokens: 0 };
const traces = [];
let verified = false;
let lastError = null;

class LLMUnavailable extends Error {}
function today() { return new Date().toISOString().slice(0, 10); }
function rollDay() {
  if (usage.day !== today()) Object.assign(usage, { day: today(), tokens: 0, calls: 0, cacheReadTokens: 0 });
}
function reason() {
  if (!ENDPOINT || !DEPLOYMENT) return 'Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT to enable Azure OpenAI';
  if (usage.calls >= DAILY_CALLS) return 'Daily AI call limit reached';
  if (usage.tokens >= DAILY_TOKENS) return 'Daily AI token limit reached';
  return null;
}
function available(estimatedTokens = 0) {
  rollDay();
  return !reason() && usage.tokens + estimatedTokens <= DAILY_TOKENS;
}
function status() {
  rollDay();
  return { model: MODEL, endpoint: ENDPOINT || null, provider: 'azure-openai', live: available() && verified,
    reason: reason() || (!verified ? lastError || 'Azure OpenAI access not yet verified' : null),
    tokensUsedToday: usage.tokens, dailyTokenBudget: DAILY_TOKENS, callsToday: usage.calls,
    dailyCallBudget: DAILY_CALLS, cacheReadTokens: usage.cacheReadTokens, rateLimitRps: RPS };
}
function record(trace) {
  traces.unshift({ id: `T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), ...trace });
  traces.length = Math.min(traces.length, 200);
}

let bucket = RPS;
let lastRefill = Date.now();
async function acquire() {
  for (;;) {
    const now = Date.now();
    bucket = Math.min(RPS, bucket + ((now - lastRefill) / 1000) * RPS);
    lastRefill = now;
    if (bucket >= 1) { bucket -= 1; return; }
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(((1 - bucket) / RPS) * 1000)));
  }
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function userPart(block) {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'image') return { type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } };
  return null;
}

/** Convert the app's provider-neutral messages to Azure OpenAI chat messages. */
function toMessages(messages) {
  const result = [];
  for (const message of messages) {
    const blocks = Array.isArray(message.content) ? message.content : [{ type: 'text', text: String(message.content) }];
    if (message.role === 'assistant') {
      const text = blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n\n');
      const calls = blocks.filter((block) => block.type === 'tool_use').map((block) => ({
        id: block.callId || block.id, type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
      }));
      result.push({ role: 'assistant', content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    const visible = blocks.map(userPart).filter(Boolean);
    if (visible.length) result.push({ role: 'user', content: visible.length === 1 && visible[0].type === 'text' ? visible[0].text : visible });
    for (const block of blocks.filter((candidate) => candidate.type === 'tool_result')) {
      result.push({ role: 'tool', tool_call_id: block.call_id || block.tool_use_id, content: String(block.content || '{}') });
    }
  }
  return result;
}

function declarations(tools, outputSchema) {
  const values = (tools || []).map((tool) => ({ type: 'function', function: {
    name: tool.name, description: tool.description, parameters: tool.input_schema,
  } }));
  if (outputSchema) values.push({ type: 'function', function: {
    name: SUBMIT, description: 'Submit the final structured result.', parameters: outputSchema,
  } });
  return values;
}

async function headers() {
  if (process.env.AZURE_OPENAI_API_KEY) return { 'api-key': process.env.AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' };
  const token = await managedIdentityToken('https://cognitiveservices.azure.com/');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function normalise(raw) {
  const choice = raw.choices?.[0];
  const message = choice?.message || {};
  const content = [];
  if (message.content) content.push({ type: 'text', text: message.content });
  for (const tool of message.tool_calls || []) {
    content.push({ type: 'tool_use', id: tool.id, callId: tool.id, name: tool.function.name,
      input: parseJson(tool.function.arguments, {}) });
  }
  if (!content.length) throw new LLMUnavailable(`AI returned no content (${choice?.finish_reason || 'unknown'})`);
  return { model: raw.model || MODEL, content,
    stop_reason: choice?.finish_reason === 'length' ? 'max_tokens' : message.tool_calls?.length ? 'tool_use' : 'end_turn',
    usage: { input_tokens: raw.usage?.prompt_tokens || 0, output_tokens: raw.usage?.completion_tokens || 0,
      cache_read_input_tokens: raw.usage?.prompt_tokens_details?.cached_tokens || 0 } };
}

async function call({ feature, system, messages, tools, maxTokens = 4000, effort = 'low', outputSchema, guardrailKind = 'donor_copy' }) {
  if (!available(maxTokens)) throw new LLMUnavailable(status().reason || 'AI budget unavailable');
  await acquire();
  usage.calls += 1;
  const started = Date.now();
  const jsonMode = Boolean(outputSchema) && !(tools && tools.length);
  const defs = declarations(tools, jsonMode ? null : outputSchema);
  const guardrails = require('./guardrails');
  const baseSystem = guardrailKind === 'none' ? system : guardrails.augmentSystem(system, guardrailKind);
  const body = {
    messages: [{ role: 'system', content: !outputSchema || jsonMode ? baseSystem : `${baseSystem}\n\nFinish by calling ${SUBMIT} with the final result.` },
      ...toMessages(messages)],
    max_completion_tokens: Math.min(maxTokens, 6000),
    // GPT-5 on Azure bills hidden reasoning tokens against this budget; keep effort low for tools.
    reasoning_effort: defs.length ? 'low' : effort,
  };
  if (defs.length) body.tools = defs;
  if (jsonMode) body.response_format = { type: 'json_schema', json_schema: { name: 'pratidaan_result', strict: true, schema: outputSchema } };
  try {
    const url = `${ENDPOINT}/openai/deployments/${encodeURIComponent(DEPLOYMENT)}/chat/completions?api-version=${encodeURIComponent(API_VERSION)}`;
    const response = await fetch(url, { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Azure OpenAI HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const value = normalise(await response.json());
    verified = true;
    lastError = null;
    usage.tokens += value.usage.input_tokens + value.usage.output_tokens;
    usage.cacheReadTokens += value.usage.cache_read_input_tokens;
    record({ feature, model: value.model, ms: Date.now() - started, stopReason: value.stop_reason,
      inputTokens: value.usage.input_tokens, outputTokens: value.usage.output_tokens,
      cacheReadTokens: value.usage.cache_read_input_tokens });
    return value;
  } catch (error) {
    const message = error.message || 'Azure OpenAI request failed';
    lastError = message;
    verified = false;
    record({ feature, model: MODEL, ms: Date.now() - started, error: message });
    console.error(`[llm] ${feature}: ${message}`);
    throw new LLMUnavailable(message);
  }
}

const PLANNING = /^(the user\b|plan:|draft \d|critique \d|revise \d|final answer:)/i;
function visibleReply(raw) {
  let value = String(raw || '').replace(/\r/g, '').trim();
  const finals = [...value.matchAll(/(?:^|\n)\s*Final Answer:\s*/gi)];
  if (finals.length) value = value.slice(finals.at(-1).index + finals.at(-1)[0].length).trim();
  const chunks = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const spoken = chunks.filter((part) => !PLANNING.test(part));
  if (spoken.length && spoken.length < chunks.length) value = spoken.join('\n\n');
  return value.trim();
}

function text(response) { return visibleReply(response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n\n')); }
function submitted(response) { return response.content.find((block) => block.type === 'tool_use' && block.name === SUBMIT)?.input || null; }

function validate(value, schema) {
  if (!schema) return true;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if ((schema.required || []).some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties || {}, key))) return false;
    return Object.entries(value).every(([key, child]) => !schema.properties?.[key] || validate(child, schema.properties[key]));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.every((item) => validate(item, schema.items));
  if (schema.type === 'integer' && !Number.isInteger(value)) return false;
  if (schema.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return false;
  if (schema.type === 'string' && typeof value !== 'string') return false;
  if (schema.type === 'boolean' && typeof value !== 'boolean') return false;
  if (typeof value === 'number' && (schema.minimum != null && value < schema.minimum || schema.maximum != null && value > schema.maximum)) return false;
  return true;
}
function structured(value, schema) {
  if (!validate(value, schema)) throw new LLMUnavailable('AI returned an invalid structured result');
  return value;
}
async function json(options) {
  const response = await call(options);
  if (response.stop_reason === 'max_tokens') throw new LLMUnavailable('Structured response cut off');
  const fromTool = submitted(response);
  if (fromTool) return structured(fromTool, options.outputSchema);
  const raw = text(response);
  if (!raw) throw new LLMUnavailable('AI did not return a structured result');
  try { return structured(JSON.parse(raw), options.outputSchema); }
  catch (error) { if (error instanceof LLMUnavailable) throw error; throw new LLMUnavailable('AI did not return a structured result'); }
}
async function verify() {
  if (!ENDPOINT || !DEPLOYMENT) return { ok: false, reason: reason() };
  return { ok: true, reason: 'Access checked on the first Azure OpenAI request' };
}

module.exports = { call, text, visibleReply, json, submitted, validate, structured, available, status, verify,
  traces: () => traces, toMessages, LLMUnavailable, MODEL, SUBMIT };
