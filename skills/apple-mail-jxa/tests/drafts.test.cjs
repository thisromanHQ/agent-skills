// Offline contract tests for the actual draft example in SKILL.md.
// Run: node --test skills/apple-mail-jxa/tests/drafts.test.cjs
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const markdown = readFileSync(join(__dirname, '..', 'SKILL.md'), 'utf8');
const example = [...markdown.matchAll(/```javascript\n([\s\S]*?)```/g)]
  .map(match => match[1]).find(block => block.includes('const expected = {'));
assert.ok(example, 'draft example exists');

function fixture(options = {}) {
  const state = { inserted: 0, saves: 0, reads: 0, waits: 0, output: [] };
  const expected = { sender: 'sender@example.invalid', subject: 'test-marker',
    content: 'Line one\nLine two.', to: ['recipient@example.invalid'], cc: [], bcc: [] };
  function message(id, fields) {
    const result = { id: () => id };
    for (const key of ['sender', 'subject', 'content']) result[key] = () => fields[key];
    for (const [key, property] of [['to', 'toRecipients'], ['cc', 'ccRecipients'], ['bcc', 'bccRecipients']]) {
      const recipients = fields[key].map(address => ({ address: () => address }));
      result[property] = () => recipients;
      result[property].push = recipient => recipients.push({ address: () => recipient.address });
    }
    return result;
  }
  const live = message(7, { ...expected, to: [], ...(options.live || {}) });
  const saved = message(1007, { ...expected, ...(options.saved || {}) });
  const outgoing = () => state.inserted ? [live] : [];
  outgoing.whose = () => () => options.duplicateOutgoing ? [live] : [];
  outgoing.push = () => { state.inserted++; };
  outgoing.byId = id => { assert.equal(id, 7); return live; };
  const messages = {
    whose: () => () => {
      if (!state.saves) return options.duplicateSaved ? [saved] : [];
      state.reads++;
      if (options.saveError) throw Error('Automation failed');
      if (options.missing || state.reads <= (options.latency || 0)) return [];
      return options.ambiguous ? [saved, saved] : [saved];
    },
    byId: id => { assert.equal(id, 1007); return saved; }
  };
  const context = {
    ObjC: { import() {} }, $: { NSThread: { sleepForTimeInterval() { state.waits++; } } },
    SENDER_ADDRESS_JSON: expected.sender, SUBJECT_JSON: expected.subject,
    BODY_JSON: expected.content, TO_ADDRESS_JSON: expected.to[0],
    ACCOUNT_ID_JSON: 'test-account', DRAFTS_MAILBOX_PATH_JSON: ['Drafts'],
    accountById: () => ({ emailAddresses: () => [expected.sender] }),
    mailboxByPath: () => ({ messages }), emit: output => state.output.push(output),
    mail: { outgoingMessages: outgoing, OutgoingMessage: properties => properties,
      ToRecipient: properties => properties, save() { state.saves++; } }
  };
  return { state, run: () => vm.runInNewContext(example, context) };
}

test('exact persisted match is verified using separate outgoing and saved IDs', () => {
  const f = fixture(); f.run();
  assert.equal(f.state.output[0].status, 'draft_verified');
  assert.equal(f.state.inserted, 1);
  assert.equal(f.state.output[0].saved_id, 1007);
});
for (const [name, saved] of Object.entries({
  whitespace: { content: '\nLine one\nLine two. \n' },
  wording: { content: 'Different wording' },
  sender: { sender: 'other@example.invalid' },
  recipient: { to: ['other@example.invalid'] },
  cc: { cc: ['extra@example.invalid'] },
  bcc: { bcc: ['extra@example.invalid'] },
  subject: { subject: 'wrong-marker' }
})) test(`${name} mismatch never reports success`, () => {
  const f = fixture({ saved }); f.run();
  assert.equal(f.state.output[0].status, 'draft_unverified');
});
test('bounded save latency reads do not recreate the draft', () => {
  const f = fixture({ latency: 2 }); f.run();
  assert.equal(f.state.reads, 3); assert.equal(f.state.waits, 2);
  assert.equal(f.state.inserted, 1);
  assert.equal(f.state.output[0].status, 'draft_verified');
});
test('empty live body blocks success even when the saved body matches', () => {
  const f = fixture({ live: { content: '' } }); f.run();
  assert.equal(f.state.output[0].checks.content, true);
  assert.equal(f.state.output[0].checks.compose_content, false);
  assert.equal(f.state.output[0].status, 'draft_unverified');
});
for (const option of ['missing', 'ambiguous', 'saveError']) test(`${option} fails closed`, () => {
  const f = fixture({ [option]: true });
  assert.throws(f.run); assert.equal(f.state.output.length, 0);
  assert.equal(f.state.inserted, 1); assert.ok(f.state.reads <= 3);
  if (option === 'saveError') assert.equal(f.state.waits, 0);
});
for (const option of ['duplicateSaved', 'duplicateOutgoing']) test(`${option} blocks creation`, () => {
  const f = fixture({ [option]: true });
  assert.throws(f.run, /Subject already exists/);
  assert.equal(f.state.inserted, 0); assert.equal(f.state.saves, 0);
});
