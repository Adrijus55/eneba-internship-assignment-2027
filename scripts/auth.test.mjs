import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

const base = process.env.STORE_TEST_URL;
test('session lifecycle, CSRF and checkout access', { skip: !base }, async () => {
  const cookies = new Map();
  const email = 'session-' + randomUUID() + '@example.test';
  const password = randomBytes(24).toString('hex');
  let csrf;
  async function request(path, method = 'GET', body, withToken = true, jar = cookies) {
    const headers = { Accept: 'application/json', Cookie: [...jar].map(([k,v]) => k + '=' + v).join('; ') };
    if (body) headers['Content-Type'] = 'application/json';
    if (csrf && withToken) headers['X-CSRF-TOKEN'] = csrf;
    const response = await fetch(base + path, { method, headers, redirect: 'manual', body: JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const pos = pair.indexOf('=');
      jar.set(pair.slice(0,pos), pair.slice(pos+1));
    }
    return response;
  }
  const guest = await request('/api/session');
  const initial = await guest.json();
  csrf = initial.csrfToken;
  assert.equal(initial.user, null);
  const checkoutPage = await fetch(base + '/checkout', { redirect: 'manual' });
  assert.equal(checkoutPage.status, 302);
  assert.equal(new URL(checkoutPage.headers.get('location'), base).href, new URL('/login', base).href);
  assert.equal((await request('/api/checkout')).status, 401);
  assert.equal((await request('/api/checkout','POST')).status, 401);
  const credentials = { email, password };
  const registration = { ...credentials, password_confirmation: password };
  assert.equal((await request('/api/register','POST',registration,false)).status,419);
  assert.equal((await request('/api/register','POST',{...registration,password_confirmation:'different'})).status,422);
  const guestJar = new Map(cookies);
  const registered = await request('/api/register','POST',registration);
  assert.equal(registered.status,201);
  console.log('Created disposable verification account ' + email);
  const session = await registered.json();
  assert.deepEqual(Object.keys(session.user).sort(), ['email','id']);
  assert.equal(session.user.email,email);
  assert.notEqual(session.csrfToken,csrf);
  csrf = session.csrfToken;
  assert.equal((await (await request('/api/session','GET',undefined,false,guestJar)).json()).user,null);
  assert.equal((await request('/api/checkout','POST')).status,422);
  assert.equal((await request('/api/logout','POST',undefined,false)).status,419);
  assert.equal((await (await request('/api/session')).json()).user.email,email);
  const oldJar = new Map(cookies);
  const logout = await request('/api/logout','POST');
  const signedOut = await logout.json();
  assert.equal(signedOut.user,null);
  csrf = signedOut.csrfToken;
  assert.equal((await request('/api/checkout','GET',undefined,false,oldJar)).status,401);
  assert.equal((await request('/api/login','POST',{email,password:'incorrect'})).status,422);
  const login = await request('/api/login','POST',credentials);
  assert.equal(login.status,200);
  csrf = (await login.json()).csrfToken;
  assert.equal((await (await request('/api/session')).json()).user.email,email);
  assert.equal((await request('/api/logout','POST')).status,200);
});
