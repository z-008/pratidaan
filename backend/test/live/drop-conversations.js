/**
 * Live check of Drop against Azure OpenAI: every Persona, single questions and multi-turn conversations about
 * the between-donation features, in the Chats a donor would use. Prints each answer with the tools Drop used,
 * and checks it: answered by the model (not the rules), no medicine, the doctor's line present whenever the
 * plan or foods came up, the donor's language, and a short answer. Not part of `npm test` (it needs the model).
 *
 *   AZURE_OPENAI_ENDPOINT=… AZURE_OPENAI_DEPLOYMENT=… AZURE_OPENAI_API_KEY=… node test/live/drop-conversations.js [D-175 …]
 *   (with no credentials it runs the same conversations against the rule answers)
 *   Writes a report to test/live/last-run.md
 */

const fs = require('fs');
const path = require('path');
const store = require('../../src/data/store');
const llm = require('../../src/ai/llm');
const copilot = require('../../src/ai/copilot');
const improvements = require('../../src/domain/improvements');
const drop = require('../../src/domain/drop');

const user = { sub: 'live-check', name: 'Live check' };
const PERSONAS = {
  'D-001': { name: 'Arjun', own: ['What can I do about my BP besides medicines?'] },
  'D-002': { name: 'Meera', own: ['Cheap vegetarian breakfast ideas for my iron?'] },
  'D-003': { name: 'Ananya', own: ["I'm healthy. Anything to keep it that way?"] },
  'D-017': { name: 'Vikram', own: ['Can I start jogging to bring my BP down?'] },
  'D-050': { name: 'Karthik', own: ['What should I eat for my blood sugar?'] },
  'D-033': { name: 'Rohan', own: ['मेरी सेहत के लिए मुझे क्या सुधार करना चाहिए?'] },
  'D-175': { name: 'Asha', own: ['How can I raise my vitamin D?', 'I don\'t eat chicken. What else for my B12?'] },
};
const SINGLE = [
  ['general', 'What should I improve in my health?'],
  ['habit:food', 'What should I eat this week?'],
  ['habit:mind', 'How did I sleep this week?'],
  ['general', 'Am I ready for my next donation?'],
  ['general', 'Why are you suggesting these foods?'],
];
const MULTI = [
  ['habit:mind', ['How did I sleep this week?', 'What could help with that?', 'Can you add that to my week?']],
  ['general', ['What should I improve?', "I don't eat eggs, what else?", 'How much would that cost a day?']],
  ['habit:movement', ['How active was I this week?', 'Plan my week for walking']],
];

const MEDICINE = /\b(tablets?|capsules?|supplements?|sachets?|injections?|pills?|ferrous|folic acid|multivitamin)\b/i;
const HINDI = /[ऀ-ॿ]/;

function check(donorId, chat, q, r) {
  const st = drop._state(donorId);
  const issues = [];
  const tools = (r.steps || []).map((s) => s.tool);
  if (r.offline || r.answeredByRules) issues.push(llm.status().live ? 'answered by rules, not the model' : 'rules (AI offline)');
  if (MEDICINE.test(r.reply) && !/never name|can't (diagnose|prescribe)|cannot diagnose/i.test(r.reply)) issues.push('mentions a medicine');
  const plan = improvements.plan(st);
  if (tools.includes('get_health_plan') && plan) for (const d of plan.doctors) if (!r.reply.includes(d.text)) issues.push(`missing doctor line: ${d.text}`);
  if (st.language === 'hi' && llm.status().live && !HINDI.test(r.reply)) issues.push('not in Hindi');
  if (r.reply.split(/\s+/).length > 120) issues.push('long answer');
  return { tools, issues };
}

async function main() {
  const only = process.argv.slice(2);
  const ids = only.length ? only : Object.keys(PERSONAS);
  const live = llm.status().live;
  const out = [`# Drop live check · ${new Date().toISOString().slice(0, 16)} · ${live ? `model ${llm.status().model}` : 'AI offline (rule answers)'}`, ''];
  let problems = 0;
  for (const id of ids) {
    store.resetDemo();
    const p = PERSONAS[id];
    out.push(`## ${p.name} (${id})`, '');
    const qs = [...SINGLE, ...p.own.map((q) => ['general', q])];
    for (const [chat, q] of qs) {
      const r = await copilot.chat({ user: { ...user, sub: `${user.sub}-${id}-${chat}-${q.length}` }, donorId: id, history: [], message: q, userName: p.name, chat });
      const c = check(id, chat, q, r);
      problems += c.issues.filter((x) => !/AI offline/.test(x)).length;
      out.push(`**${chat} · ${q}**`, '', `> ${r.reply.replace(/\n/g, ' ')}`, '', `tools: ${c.tools.join(', ') || '—'}${r.actions?.length ? ` · actions: ${r.actions.map((a) => a.type).join(', ')}` : ''}${c.issues.length ? ` · **check: ${c.issues.join('; ')}**` : ' · ok'}`, '');
    }
    for (const [chat, turns] of MULTI) {
      out.push(`**Conversation in ${chat}**`, '');
      let history = [];
      const sub = `${user.sub}-${id}-multi-${chat}`;
      for (const q of turns) {
        const r = await copilot.chat({ user: { ...user, sub }, donorId: id, history, message: q, userName: p.name, chat });
        const c = check(id, chat, q, r);
        problems += c.issues.filter((x) => !/AI offline/.test(x)).length;
        out.push(`- **${q}**`, `  > ${r.reply.replace(/\n/g, ' ')}`, `  tools: ${c.tools.join(', ') || '—'}${c.issues.length ? ` · **check: ${c.issues.join('; ')}**` : ' · ok'}`);
        history = r.history && r.history.length ? r.history : [...history, { role: 'user', content: q }, { role: 'assistant', content: r.reply }];
      }
      out.push('');
    }
  }
  out.push(`---`, `${problems} problem(s) found.`);
  const file = path.join(__dirname, 'last-run.md');
  fs.writeFileSync(file, out.join('\n'));
  console.log(out.join('\n'));
  console.log(`\nReport: ${file}`);
  process.exit(problems && live ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
