// Run with Node 22+ and the path to this assignment's Codex JSONL file.
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../AI_CHAT_HISTORY.md', import.meta.url));
const thread = '01a2080b-f173-7f03-b350-1687d7a352c0';
const internalItems = new Set(['CommandExecution', 'McpToolCall', 'Reasoning',
  'FileChange', 'WebSearch', 'ImageView']);
const questionTools = new Set(['request_user_input', 'request_user_input_async']);

function requireText(value) {
  if (typeof value !== 'string') throw new Error('Expected verbatim text. Review the source schema.');
  return value;
}

function messageBody(item) {
  if (item.type === 'Plan') return requireText(item.text);
  return item.content.map(part => {
    if (!['Text', 'text'].includes(part.type)) throw new Error('Unknown message part: ' + part.type);
    return requireText(part.text);
  }).join('');
}

function questionBody(question) {
  const lines = [question.header, question.question ?? question.title].filter(v => v !== undefined);
  for (const option of question.options ?? []) {
    if (typeof option === 'string') lines.push(option);
    else lines.push(option.label, option.description);
  }
  return lines.map(requireText).join('\n');
}

function collect(records) {
  const entries = [];
  const seen = new Map();
  const pending = new Map();
  // Some Codex versions also record the exact text shown in the question card.
  const questionCards = new Map();
  for (const { type, payload } of records) {
    const item = payload.item;
    if (type === 'event_msg' && payload.type === 'item_completed' &&
        item.type === 'AgentMessage' && item.questions) {
      questionCards.set(item.id, messageBody(item));
    }
  }
  let activeTurn;
  let completedTurn;
  function add(id, role, body) {
    if (!id) throw new Error('Missing message ID.');
    if (seen.has(id)) {
      if (seen.get(id) !== body) throw new Error('Conflicting message for ' + id);
      return;
    }
    seen.set(id, body);
    entries.push({ role, body });
  }
  if (!records.some(r => r.type === 'session_meta' && r.payload.id === thread)) {
    throw new Error('The input is not the assignment chat.');
  }
  for (const { type, payload: p } of records) {
    if (type === 'event_msg') {
      if (p.type === 'task_started') activeTurn = p.turn_id;
      if (p.type === 'task_complete') completedTurn = p.turn_id;
      if (p.type !== 'item_completed') continue;
      const i = p.item;
      if (['UserMessage', 'AgentMessage', 'Plan'].includes(i.type)) {
        add(i.id, i.type === 'UserMessage' ? 'User' : 'Assistant', messageBody(i));
      } else if (!internalItems.has(i.type) && !(i.type === 'Extension' && i.kind === 'web.search')) {
        throw new Error('Review an unrecognized chat item before exporting: ' + i.type);
      }
      continue;
    }
    if (type !== 'response_item') continue;
    if (p.type === 'function_call' && questionTools.has(p.name)) {
      const { questions } = JSON.parse(p.arguments);
      add(p.call_id, 'Assistant', questionCards.get(p.call_id) ?? questions.map(questionBody).join('\n\n'));
      pending.set(p.call_id, questions);
    } else if (p.type === 'function_call_output' && pending.has(p.call_id)) {
      const result = JSON.parse(p.output);
      if (result.answers) {
        const answers = Object.values(result.answers).flatMap(answer => answer.answers.map(requireText));
        if (answers.length) add(p.call_id + '-reply', 'User', answers.join('\n'));
      }
      pending.delete(p.call_id);
    } else if (p.type === 'function_call' && p.name === 'send_message_to_user_async') {
      add(p.call_id, 'Assistant', requireText(JSON.parse(p.arguments).message));
    }
  }
  if (!entries.length) throw new Error('The source contains no visible conversation.');
  return { entries, activeTurn, completedTurn };
}

function render(entries) {
  let markdown = '# AI chat history\n';
  for (const { role, body } of entries) markdown += '\n## ' + role + '\n\n' + body + '\n';
  return Buffer.from(markdown, 'utf8');
}

async function snapshot(path) {
  const source = await readFile(path, 'utf8');
  // A running client can still be appending its last JSON line.
  const lines = source.split('\n');
  const tail = lines.pop();
  const records = lines.filter(Boolean).map(line => JSON.parse(line));
  if (tail?.trim()) {
    try { records.push(JSON.parse(tail)); }
    catch { throw new Error('The last record is incomplete. Retry after the client finishes writing it.'); }
  }
  return collect(records);
}

async function save(entries) {
  const bytes = render(entries);
  const tmp = output + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(tmp, bytes, { flag: 'wx', mode: 0o600 });
    if (!(await readFile(tmp)).equals(bytes)) throw new Error('Export readback mismatch.');
    await rename(tmp, output);
  } finally {
    await unlink(tmp).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  console.log('Saved ' + entries.length + ' visible entries (' + bytes.length + ' UTF-8 bytes).');
  const credential = /postgres(?:ql)?:\/\/[^\s/@]+:[^\s/@]+@|-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|(?:sk-|rnd_|napi_)[a-zA-Z0-9_-]{20,}|APP_KEY\s*=\s*base64:[\w+/=]{30,}/i;
  if (entries.some(entry => credential.test(entry.body))) {
    throw new Error('Possible credential in the saved private transcript. Stop before publishing and review locally.');
  }
}

const [source, flag] = process.argv.slice(2);
if (!source || (flag && flag !== '--finish-turn')) throw new Error('Usage: node scripts/export-chat.mjs SESSION.jsonl [--finish-turn]');
let state = await snapshot(source);
await save(state.entries);
if (flag === '--finish-turn') {
  const turn = state.activeTurn;
  const deadline = Date.now() + 60 * 60 * 1000;
  while (state.completedTurn !== turn) {
    if (Date.now() > deadline) throw new Error('Turn still open. Rerun export after completion.');
    await new Promise(resolve => setTimeout(resolve, 3000));
    state = await snapshot(source);
    if (state.activeTurn !== turn && state.completedTurn !== turn) throw new Error('Turn changed. Rerun export.');
  }
  await save(state.entries);
}
