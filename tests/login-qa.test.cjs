const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync('index.html', 'utf8');
const start = source.indexOf('    async function loginWithGoogle()');
const end = source.indexOf('    if (!window.supabase?.createClient)', start);
assert.ok(start >= 0 && end > start);
function load(signIn) {
  let expire;
  const calls = [], states = [], clears = [], delays = [];
  const context = {
    login: { disabled: false },
    client: { auth: { signInWithOAuth: args => { calls.push(args); return signIn(); } } },
    window: { location: { origin: 'https://example.invalid', pathname: '/ats/' } },
    status: (message, error = false) => states.push({ message, error }),
    setTimeout: (callback, delay) => { expire = callback; delays.push(delay); return 1; },
    clearTimeout: handle => clears.push(handle), Error,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return { context, calls, states, clears, delays, expire: () => expire() };
}
test('Google login preserves provider, account choice prompt and callback URL', async () => {
  const a = load(async () => ({ error: null }));
  await a.context.loginWithGoogle();
  assert.deepEqual(JSON.parse(JSON.stringify(a.calls)), [{ provider: 'google', options: {
    redirectTo: 'https://example.invalid/ats/', queryParams: { prompt: 'select_account' } } }]);
  assert.equal(a.context.login.disabled, true);
  assert.equal(a.states.at(-1).error, false);
  assert.deepEqual(a.clears, [1]);
});
test('Returned OAuth error restores retry button and shows the error', async () => {
  const a = load(async () => ({ error: { message: 'Provider unavailable' } }));
  await a.context.loginWithGoogle();
  assert.equal(a.context.login.disabled, false);
  assert.deepEqual(a.states.at(-1), { message: 'Provider unavailable', error: true });
  assert.deepEqual(a.clears, [1]);
});
test('Thrown OAuth errors are caught instead of leaving a silent disabled button', async () => {
  const a = load(async () => { throw new Error('Network error'); });
  await a.context.loginWithGoogle();
  assert.equal(a.context.login.disabled, false);
  assert.deepEqual(a.states.at(-1), { message: 'Network error', error: true });
  assert.deepEqual(a.clears, [1]);
});
test('A hung OAuth request times out at 15 seconds and requires reload without retrying', async () => {
  const a = load(() => new Promise(() => {}));
  const pending = a.context.loginWithGoogle();
  assert.deepEqual(a.delays, [15000]);
  a.expire();
  await pending;
  assert.equal(a.context.login.disabled, true);
  assert.match(a.states.at(-1).message, /Tải lại trang rồi thử lại/);
  assert.equal(a.states.at(-1).error, true);
  assert.equal(a.calls.length, 1);
  assert.deepEqual(a.clears, [1]);
});
