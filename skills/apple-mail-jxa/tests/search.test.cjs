// Offline contract tests for the bounded cross-account JXA search example.
// Run: node --test skills/apple-mail-jxa/tests/*.test.cjs
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const markdown = readFileSync(join(__dirname, '..', 'SKILL.md'), 'utf8');
const example = [...markdown.matchAll(/```javascript\n([\s\S]*?)```/g)]
  .map(match => match[1]).find(block => block.includes('const maxMailboxes = 50;'));
assert.ok(example, 'bounded cross-account search example exists');

function message(id, sender, subject = 'test') {
  return {
    id: () => id, sender: () => sender, subject: () => subject,
    dateReceived: () => new Date('2026-01-01T00:00:00Z')
  };
}

function box(name, children = [], items = []) {
  const messages = {
    whose: predicate => () => {
      assert.ok(predicate.sender._contains);
      return items.filter(item => item.sender().toLowerCase()
        .includes(predicate.sender._contains));
    }
  };
  return { name: () => name, mailboxes: () => children, messages };
}

function fixture(accounts, wanted = 'billing@example.invalid') {
  const context = {
    Application: () => ({ accounts: () => accounts }),
    SEARCH_SENDER_JSON: wanted,
    isoDate: value => value.toISOString()
  };
  return JSON.parse(vm.runInNewContext(example, context));
}

test('searches enabled accounts, preserves mailbox paths, and deduplicates only within an account', () => {
  const first = message(7, 'Billing <billing@example.invalid>');
  const a = { id: () => 'a', enabled: () => true,
    mailboxes: () => [box('Inbox', [box('Bills', [], [first])])] };
  const b = { id: () => 'b', enabled: () => true,
    mailboxes: () => [box('Bills', [], [message(7, 'billing@example.invalid')])] };
  const disabled = { id: () => 'disabled', enabled: () => false,
    mailboxes: () => [box('Inbox', [], [message(9, 'billing@example.invalid')])] };
  const result = fixture([a, b, disabled]);
  assert.equal(result.search_complete, true);
  assert.deepEqual(result.messages.map(x => [x.account_id, x.mailbox_path, x.id]), [
    ['a', ['Inbox', 'Bills'], 7], ['b', ['Bills'], 7]
  ]);
});

test('reaching mailbox cap marks the cross-account search partial', () => {
  const many = Array.from({length: 51}, (_, i) => box(`Folder-${i}`));
  const a = { id: () => 'a', enabled: () => true, mailboxes: () => many };
  const result = fixture([a]);
  assert.equal(result.mailboxes_examined, 50);
  assert.equal(result.mailbox_cap_reached, true);
  assert.equal(result.search_complete, false);
});

test('no matches reports the searched scopes without claiming a match', () => {
  const a = { id: () => 'a', enabled: () => true,
    mailboxes: () => [box('Inbox', [], [message(1, 'other@example.invalid')])] };
  const result = fixture([a]);
  assert.equal(result.search_complete, true);
  assert.equal(result.mailboxes_examined, 1);
  assert.deepEqual(result.messages, []);
});

test('skill no longer instructs local database access or Full Disk Access', () => {
  assert.doesNotMatch(markdown, /Direct Envelope Index Search|\/usr\/bin\/sqlite3/);
  assert.match(markdown, /Full Disk Access for a\s*\nsearch/);
  assert.match(markdown, /Do not claim a global search was exhaustive/);
});
