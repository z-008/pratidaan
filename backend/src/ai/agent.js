/**
 * Manual tool-use loop shared by Pratidaan's agents.
 *
 * Runs Gemini with a donor-scoped tool set until it stops calling tools,
 * executing tool calls in parallel and returning the final text, the full
 * step trace (for the "how the agent decided" panel) and any UI actions the
 * agent requested via the navigate tool.
 */

const llm = require('./llm');
const tools = require('./tools');

const MAX_STEPS = 8;

async function runAgent({ feature, system, messages, donorId, toolNames, maxTokens = 3000, effort = 'low', outputSchema }) {
  const toolDefs = tools.definitions(toolNames);
  const convo = [...messages];
  const steps = [];
  const actions = [];
  let nudged = false;
  let retriedMalformed = false;
  const partial = () => ({ text: '', steps, actions, messages: convo, incomplete: true });

  for (let i = 0; i < MAX_STEPS; i += 1) {
    let response;
    try {
      response = await llm.call({ feature, system, messages: convo, tools: toolDefs, maxTokens, effort, outputSchema, guardrailKind: 'chat' });
    } catch (error) {
      // Gemini Flash-Lite occasionally emits a malformed tool call; one retry almost always succeeds
      if (/MALFORMED_FUNCTION_CALL/.test(error.message) && !retriedMalformed) {
        retriedMalformed = true;
        i -= 1;
        continue;
      }
      // Gemini sometimes ends with no text right after a tool call. Ask once more for the answer
      // (in the same turn as the tool results); if it is still empty, the caller answers from rules.
      if (i > 0 && !outputSchema && /no content/.test(error.message)) {
        const last = convo[convo.length - 1];
        if (!nudged && last && last.role === 'user' && Array.isArray(last.content)) {
          nudged = true;
          convo[convo.length - 1] = { ...last, content: [...last.content, { type: 'text', text: 'Now answer the donor in one or two short sentences, using these tool results.' }] };
          continue;
        }
        return partial();
      }
      if (steps.length && !outputSchema) return partial();
      throw error;
    }
    if (response.stop_reason === 'max_tokens') {
      if (steps.length && !outputSchema) return partial();
      throw new llm.LLMUnavailable('Response cut off');
    }

    const result = outputSchema ? llm.submitted(response) : null;
    if (result) return { result: llm.structured(result, outputSchema), steps, actions };

    const toolUses = response.content.filter((b) => b.type === 'tool_use' && b.name !== llm.SUBMIT);
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      if (outputSchema) {
        // Finished in prose instead of submitting: ask once more for the structured result
        convo.push({ role: 'assistant', content: response.content });
        convo.push({ role: 'user', content: `Please submit your final result with the ${llm.SUBMIT} tool now.` });
        continue;
      }
      const spoken = llm.text(response);
      // Keep the saved turn to what the donor was shown, so the next turn does not continue a private note
      const content = response.content.every((b) => b.type === 'text') ? [{ type: 'text', text: spoken }] : response.content;
      return { text: spoken, steps, actions, messages: [...convo, { role: 'assistant', content }] };
    }

    convo.push({ role: 'assistant', content: response.content });
    const results = await Promise.all(toolUses.map(async (call) => {
      const started = Date.now();
      let output;
      let isError = false;
      try {
        output = tools.run(call.name, call.input, donorId);
      } catch (error) {
        output = { error: error.message };
        isError = true;
      }
      steps.push({ tool: call.name, input: call.input, ms: Date.now() - started, summary: summarise(call.name, output) });
      if (call.name === 'navigate' && !output?.error) actions.push({ type: 'navigate', screen: call.input.screen, reason: call.input.reason });
      // Tools can put something on screen (a Drop Card, a chart, a memory line); the model only sees the facts
      let modelOutput = output;
      if (output && output._ui) {
        actions.push(output._ui);
        const { _ui, ...rest } = output;
        modelOutput = rest;
      }
      return { type: 'tool_result', tool_use_id: call.id, name: call.name, ...(call.callId ? { call_id: call.callId } : {}),
        content: JSON.stringify(modelOutput), ...(isError ? { is_error: true } : {}) };
    }));
    convo.push({ role: 'user', content: results });
  }
  if (steps.length && !outputSchema) return partial();
  throw new llm.LLMUnavailable('Agent did not finish within the step limit');
}

/** Short human-readable description of a tool result for the trace panel. */
function summarise(name, output) {
  if (output && output.error) return `Error: ${output.error}`;
  if (Array.isArray(output)) return `${output.length} item(s)`;
  switch (name) {
    case 'get_profile': return `${output.name}, ${output.donations} donations, eligible now: ${output.eligibility.eligibleNow}`;
    case 'get_health_score': return `Latest score ${output.history.length ? output.history[output.history.length - 1].score : '—'}`;
    case 'get_insurance_cover': return output.linked === false ? 'No insurer linked' : `Cover ₹${(output.currentCover / 1e5).toFixed(0)}L, qualifies ₹${(output.eligibleCover / 1e5).toFixed(0)}L`;
    case 'simulate_cover': return output.cover == null ? 'No insurer linked' : `Score ${output.score} → ₹${(output.cover / 1e5).toFixed(0)}L`;
    case 'get_donation_impact': return `${output.totals.patientsHelped} patients helped from ${output.totals.components} components`;
    case 'get_protocol': return output.name;
    case 'get_lifestyle_guidance': return output.title;
    case 'navigate': return `Opened ${output.screen}`;
    case 'show_chart': return `Chart of ${output.marker} (${output.points.length} points)`;
    case 'offer_care_slots': return `Offered ${output.slots.length} check-up slots`;
    case 'offer_reminder': return 'Offered a reminder';
    case 'remember': return `Remembered: ${output.remembered}`;
    case 'log_reading': return output.saved;
    case 'set_language': return `Language set to ${output.language}`;
    default: return 'OK';
  }
}

module.exports = { runAgent };
