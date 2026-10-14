const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8');
const fixtureId = 'a81a1a1e-287a-4ce7-9961-8b486e350c36';
function load({ selection, value = '[TEST ONLY] Candidate', confirmed = true, response } = {}) {
  let submit;
  const calls = [], statuses = [], refreshes = [], questions = [];
  const button = { disabled: false };
  const form = { hidden: false, reportValidity: () => true, querySelector: () => button,
    addEventListener: (_event, callback) => { submit = callback; } };
  const context = {
    selectedReview: selection ?? { kind: 'cv', id: fixtureId, state: 'pending_review',
      intakeState: 'ready_for_review', expectedValue: null, isCorrectionFixture: true },
    document: { getElementById: id => id === 'correction-form' ? form : { value } },
    window: { confirm: question => { questions.push(question); return confirmed; } },
    client: { functions: { invoke: async (name, request) => {
      calls.push({ name, body: request.body });
      return response ?? { data: { correction: { changed: true } }, error: null };
    } } },
    reviewStatus: (message, error = false) => statuses.push({ message, error }),
    loadReviewList: async () => { refreshes.push('list'); context.selectedReview = null; },
    loadReviewDetail: async (kind, id) => refreshes.push({ kind, id }),
    Error, Boolean,
  };
  vm.createContext(context);
  for (const [start, end] of [
    ['    const correctionFixtures =', '    function status('],
    ['    async function reviewCall(', '    function reviewStatus('],
    ['    document.getElementById("correction-form").addEventListener', '    async function decideReview('],
    ['    async function decideReview(', '    document.getElementById("review-approve").addEventListener'],
  ]) {
    const first = source.indexOf(start), last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `Missing script segment ${start}`);
    vm.runInContext(source.slice(first, last), context);
  }
  return { context, calls, statuses, refreshes, form, button, questions,
    submit: () => submit({ preventDefault() {}, currentTarget: form }) };
}

test('QA allowlist requires exact kind, ID, synthetic source URL and TEST ONLY name', () => {
  const { context } = load();
  const intake = { kind: 'cv', drive_url: 'https://example.invalid/ats-cv-correction-e2e-20261013.pdf',
    original_name: '[TEST ONLY] Synthetic CV.pdf' };
  assert.equal(context.correctionFixtureAllowed('cv', fixtureId, intake), true);
  for (const [kind, id, data] of [['jd', fixtureId, intake], ['cv', 'other', intake],
    ['cv', fixtureId, { ...intake, drive_url: 'https://drive.google.com/real' }],
    ['cv', fixtureId, { ...intake, original_name: 'Real CV.pdf' }], ['cv', fixtureId, null]]) {
    assert.equal(context.correctionFixtureAllowed(kind, id, data), false);
  }
});

test('CV submit binds viewed expected value and refreshes list/detail after success', async () => {
  const a = load();
  await a.submit();
  assert.equal(a.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(a.calls[0])), { name: 'ta-review', body: {
    action: 'correct_title', kind: 'cv', id: fixtureId, expected_value: null, value: '[TEST ONLY] Candidate' } });
  assert.deepEqual(a.refreshes, ['list', { kind: 'cv', id: fixtureId }]);
  assert.match(a.questions[0], new RegExp(fixtureId));
  assert.match(a.statuses.at(-1).message, /audit được lưu/);
  assert.equal(a.button.disabled, false);
});

test('Separate TA fixture requires its own exact source and remains correction-only', async () => {
  const id = '30d9c99f-9f76-4e3b-be16-0a9632646df1';
  const a = load({ selection: { kind: 'cv', id, state: 'pending_review',
    intakeState: 'ready_for_review', expectedValue: null, isCorrectionFixture: true } });
  const intake = { kind: 'cv', original_name: '[TEST ONLY] TA CV QA',
    drive_url: 'https://example.invalid/ats-ta-cv-correction-e2e-20261014.pdf' };
  assert.equal(a.context.correctionFixtureAllowed('cv', id, intake), true);
  assert.equal(a.context.correctionFixtureAllowed('cv', fixtureId, intake), false);
  assert.equal(a.context.correctionFixtureAllowed('cv', id, { ...intake,
    drive_url: 'https://example.invalid/ats-cv-correction-e2e-20261013.pdf' }), false);
  assert.equal(a.context.correctionFixtureAllowed('jd', id, intake), false);
  assert.equal(a.context.correctionFixtureAllowed('cv', id, { ...intake,
    original_name: 'Real CV.pdf' }), false);
  await a.context.decideReview('approved');
  assert.equal(a.calls.length, 0);
  await a.submit();
  assert.equal(a.calls.length, 1);
  assert.equal(a.calls[0].body.id, id);
  assert.equal(a.calls[0].body.expected_value, null);
});

test('QA corrections cannot target arbitrary, reviewed or unready drafts; cancelled submit is inert', async () => {
  const base = load().context.selectedReview;
  for (const options of [{ selection: { ...base, id: 'other' } },
    { selection: { ...base, isCorrectionFixture: false } },
    { selection: { ...base, state: 'approved' } },
    { selection: { ...base, intakeState: 'possible_duplicate' } },
    { value: 'Real name' }, { confirmed: false }]) {
    const a = load(options); await a.submit(); assert.equal(a.calls.length, 0);
  }
});

test('No-op remains visible and does not imply an additional audit', async () => {
  const a = load({ response: { data: { correction: { changed: false } }, error: null } });
  await a.submit();
  assert.equal(a.calls.length, 1);
  assert.match(a.statuses.at(-1).message, /không ghi audit mới/);
});

test('HTTP 409 invalidates stale selection and requires reload before another correction', async () => {
  const a = load({ response: { data: null, error: { context: Response.json({ error: 'Bản nháp đã thay đổi.' }, { status: 409 }) } } });
  await a.submit();
  assert.equal(a.context.selectedReview, null);
  assert.equal(a.form.hidden, true);
  assert.equal(a.refreshes.length, 0);
  assert.match(a.statuses.at(-1).message, /Bấm Tải lại/);
  assert.equal(a.statuses.at(-1).error, true);
  assert.equal(a.button.disabled, false);
  await a.submit();
  assert.equal(a.calls.length, 1, 'Stale retry must not send another mutation');
});

test('QA fixture cannot be approved through the decision handler', async () => {
  const a = load();
  await a.context.decideReview('approved');
  assert.equal(a.calls.length, 0);
});
