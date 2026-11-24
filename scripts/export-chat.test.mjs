import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('export preserves exact bodies, is repeatable, and reports schema changes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'eneba-chat-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts'));
  const script = join(dir, 'scripts/export-chat.mjs');
  await copyFile(new URL('./export-chat.mjs', import.meta.url), script);
  const input = join(dir, 'sample.jsonl');
  const output = join(dir, 'AI_CHAT_HISTORY.md');
  const run = () => execFileSync(process.execPath, [script, input], { stdio: 'pipe' });
  const item = value => ({ type: 'event_msg', payload: { type: 'item_completed', item: value } });
  const body = 'Lietuviškai  \r\n\r\n```php\n  echo 1;\n```\n';
  const message = item({ type: 'UserMessage', id: 'one', content: [{ type: 'text', text: body }] });
  const records = [
    { type: 'session_meta', payload: { id: '01a2080b-f173-7f03-b350-1687d7a352c0' } },
    message, message,
    item({ type: 'Reasoning', id: 'private' }),
    item({ type: 'ContextCompaction', id: 'context-only' }),
    item({ type: 'Plan', id: 'two', text: 'Plan\n' }),
  ];
  const save = () => writeFile(input, records.map(v => JSON.stringify(v)).join('\n'));
  await save();
  run();
  const expected = '# AI chat history\n\n## User\n\n' + body + '\n\n## Assistant\n\nPlan\n\n';
  assert.deepEqual(await readFile(output), Buffer.from(expected));
  run();
  assert.deepEqual(await readFile(output), Buffer.from(expected));
  records.push(item({ type: 'FutureMessage', id: 'unknown' }));
  await save();
  assert.throws(run, /unrecognized chat item/);
  assert.deepEqual(await readFile(output), Buffer.from(expected));
  records.pop();
  const question = { title: 'Where?', options: ['Here', 'Elsewhere'] };
  const card = 'Where?\n- Here\n- Elsewhere';
  records.push({ type: 'response_item', payload: {
    type: 'function_call', name: 'request_user_input_async', call_id: 'card',
    arguments: JSON.stringify({ questions: [question] }),
  } });
  records.push(item({ type: 'AgentMessage', id: 'card', questions: [question],
    content: [{ type: 'Text', text: card }] }));
  await save();
  run();
  assert.equal(await readFile(output, 'utf8'), expected + '\n## Assistant\n\n' + card + '\n');
  const example = 'ghp_' + 'x'.repeat(24);
  records.push(item({ type: 'AgentMessage', id: 'three', content: [{ type: 'Text', text: example }] }));
  await save();
  assert.throws(run, /Possible credential/);
  assert.ok((await readFile(output, 'utf8')).endsWith(example + '\n'));
});
