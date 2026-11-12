/** Gemini on Vertex AI. Cloud Run uses its service account; a laptop uses Application Default Credentials. No API key. */
const { GoogleAuth } = require('google-auth-library');
const MODEL = process.env.LLM_MODEL || 'gemini-3.1-flash-lite';
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || '';
const LOCATION = process.env.VERTEX_LOCATION || 'global';
const ENDPOINT = LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${LOCATION}-aiplatform.googleapis.com`;
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
  if (!PROJECT) return 'Set GOOGLE_CLOUD_PROJECT to enable Vertex AI';
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
  return { model: MODEL, endpoint: ENDPOINT, live: available() && verified, reason: reason() || (!verified ? lastError || 'Vertex access not yet verified' : null),
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
function toPart(block) {
  if (block.type === 'text') return { text: block.text };
  if (block.type === 'image') return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
  if (block.type === 'tool_use') return { functionCall: { name: block.name, args: block.input, ...(block.callId ? { id: block.callId } : {}) },
    ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}) };
  if (block.type === 'tool_result') {
    let value;
    try { value = JSON.parse(block.content); } catch { value = block.content; }
    // Gemini 3 matches each response to its call by id when the call carried one
    return { functionResponse: { name: block.name || block.tool_use_id.split(':')[0], response: functionResponseBody(value),
      ...(block.call_id ? { id: block.call_id } : {}) } };
  }
  throw new Error(`Unsupported message block: ${block.type}`);
}
function toContents(messages) {
  return messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user',
    parts: (Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }]).map(toPart) }));
}
/** Vertex requires functionResponse.response to be a JSON object, not a list or scalar. */
function functionResponseBody(value) {
  if (Array.isArray(value)) return { items: value };
  if (value !== null && typeof value === 'object') return value;
  return { result: value };
}
function cleanSchema(value) {
  if (Array.isArray(value)) return value.map(cleanSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'additionalProperties')
    .map(([key, child]) => [key, key === 'type' ? String(child).toUpperCase() : cleanSchema(child)]));
}
function declarations(tools, outputSchema) {
  const defs = (tools || []).map((t) => ({ name: t.name, description: t.description, parameters: cleanSchema(t.input_schema) }));
  if (outputSchema) defs.push({ name: SUBMIT, description: 'Submit the final structured result.', parameters: cleanSchema(outputSchema) });
  return defs;
}
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
async function accessToken() {
  const client = await auth.getClient();
  const result = await client.getAccessToken();
  const token = typeof result === 'string' ? result : result && result.token;
  if (!token) throw new Error('Google Cloud credentials unavailable. On a laptop run: gcloud auth application-default login');
  return token;
}
function normalise(raw) {
  const candidate = raw.candidates?.[0];
  const content = (candidate?.content?.parts || []).flatMap((p, index) => {
    // Gemini marks its private reasoning as a part. It is not part of the reply.
    if (p.thought) return [];
    if (p.text) return [{ type: 'text', text: p.text }];
    if (p.functionCall) return [{ type: 'tool_use', id: `${p.functionCall.name}:${index}`, name: p.functionCall.name,
      input: p.functionCall.args || {}, ...(p.functionCall.id ? { callId: p.functionCall.id } : {}),
      ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}) }];
    return [];
  });
  if (!content.length) throw new LLMUnavailable(`AI returned no content (${candidate?.finishReason || raw.promptFeedback?.blockReason || 'unknown'})`);
  return { model: MODEL, content, stop_reason: candidate?.finishReason === 'MAX_TOKENS' ? 'max_tokens'
    : content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
  usage: { input_tokens: raw.usageMetadata?.promptTokenCount || 0, output_tokens: raw.usageMetadata?.candidatesTokenCount || 0,
    cache_read_input_tokens: raw.usageMetadata?.cachedContentTokenCount || 0 } };
}
async function call({ feature, system, messages, tools, maxTokens = 4000, outputSchema, guardrailKind = 'donor_copy' }) {
  if (!available(maxTokens)) throw new LLMUnavailable(status().reason || 'AI budget unavailable');
  await acquire();
  usage.calls += 1;
  const started = Date.now();
  const jsonMode = Boolean(outputSchema) && !(tools && tools.length);
  const defs = declarations(tools, jsonMode ? null : outputSchema);
  const guardrails = require('./guardrails');
  const baseSystem = guardrailKind === 'none' ? system : guardrails.augmentSystem(system, guardrailKind);
  const body = { systemInstruction: { parts: [{ text: !outputSchema || jsonMode ? baseSystem : `${baseSystem}\n\nFinish by calling ${SUBMIT} with the final result.` }] },
    contents: toContents(messages), generationConfig: { maxOutputTokens: Math.min(maxTokens, 6000) } };
  if (jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = cleanSchema(outputSchema);
  }
  if (defs.length) body.tools = [{ functionDeclarations: defs }];
  try {
    const token = await accessToken();
    const url = `https://${ENDPOINT}/v1/projects/${encodeURIComponent(PROJECT)}/locations/${encodeURIComponent(LOCATION)}/publishers/google/models/${encodeURIComponent(MODEL)}:generateContent`;
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`Vertex AI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const response = normalise(await res.json());
    verified = true;
    lastError = null;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    usage.tokens += inputTokens + outputTokens;
    usage.cacheReadTokens += response.usage.cache_read_input_tokens;
    record({ feature, model: MODEL, ms: Date.now() - started, stopReason: response.stop_reason,
      inputTokens, outputTokens, cacheReadTokens: response.usage.cache_read_input_tokens });
    return response;
  } catch (error) {
    const message = error.message || 'Vertex AI request failed';
    lastError = message;
    verified = false;
    record({ feature, model: MODEL, ms: Date.now() - started, error: message });
    console.error(`[llm] ${feature}: ${message}`);
    throw new LLMUnavailable(message);
  }
}
const PLANNING = /^(the user\b|plan:|draft \d|critique \d|revise \d|final answer:)/i;

/** The words meant for the donor. Drops a reasoning note if the model wrote one into the answer. */
function visibleReply(raw) {
  let t = String(raw || '').replace(/\r/g, '').trim();
  const finals = [...t.matchAll(/(?:^|\n)\s*Final Answer:\s*/gi)];
  if (finals.length) t = t.slice(finals[finals.length - 1].index + finals[finals.length - 1][0].length).trim();
  const chunks = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const spoken = chunks.filter((s) => !PLANNING.test(s));
  if (spoken.length && spoken.length < chunks.length) t = spoken.join('\n\n');
  return t.trim();
}

function text(response) { return visibleReply(response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n')); }
function submitted(response) { return response.content.find((b) => b.type === 'tool_use' && b.name === SUBMIT)?.input || null; }
/** Check raw Gemini output against the application schema; provider-side constraints are not a trust boundary. */
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
  try { return structured(JSON.parse(raw), options.outputSchema); } catch (error) {
    if (error instanceof LLMUnavailable) throw error;
    throw new LLMUnavailable('AI did not return a structured result');
  }
}
async function verify() {
  if (!PROJECT) return { ok: false, reason: reason() };
  return { ok: true, reason: 'Access checked on the first AI request' };
}
module.exports = { call, text, visibleReply, json, submitted, validate, structured, available, status, verify, traces: () => traces, toContents, LLMUnavailable, MODEL, SUBMIT };
