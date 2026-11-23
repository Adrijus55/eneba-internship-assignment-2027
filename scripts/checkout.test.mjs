// Run against two PHP workers sharing a fresh disposable database with the demo catalog.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';

const first = process.env.CHECKOUT_TEST_URL;
const second = process.env.CHECKOUT_TEST_SECOND_URL;

async function buyer(base) {
  const cookies = new Map();
  let csrf;
  async function call(path, body, server = base) {
    const response = await fetch(server + '/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        Cookie: [...cookies].map(([k,v]) => k + '=' + v).join('; '), 'X-CSRF-TOKEN': csrf ?? '' },
      body: body && JSON.stringify(body),
    });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0], split = pair.indexOf('=');
      cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    return { status: response.status, data: await response.json() };
  }
  csrf = (await call('session')).data.csrfToken;
  const password = randomBytes(24).toString('hex');
  const registered = await call('register', {email: randomUUID()+'@example.test', password, password_confirmation:password});
  assert.equal(registered.status,201);
  csrf = registered.data.csrfToken;
  return { call, id: registered.data.user.id };
}

test('atomic checkout, concurrent retries, last-key contention and receipt ownership', {skip: !first || !second}, async () => {
  const a = await buyer(first), b = await buyer(second);
  const offers = (await a.call('products/1')).data.offers;
  const stock = async id => (await a.call('offers/'+id)).data.available_keys;
  const items = offers.map(o => ({offer_id:o.id, price_cents:o.price_cents}));
  const [cheap, other] = items;
  assert.equal(await stock(cheap.offer_id),3, 'Use a freshly migrated test database');
  const pay = (client, lines, extra = {}) => client.call('checkout', {request_id:randomUUID(), items:lines, ...extra});
  assert.equal((await pay(a,[{...cheap,price_cents:1}])).status,409);
  assert.deepEqual((await a.call('orders')).data,[]);

  const intent = {request_id:randomUUID(), items:[cheap], user_id:b.id};
  const retries = await Promise.all([a.call('checkout',intent,first),a.call('checkout',intent,second)]);
  assert.deepEqual(retries.map(r=>r.status).sort(),[200,201]);
  const id = retries[0].data.order_id;
  assert.equal(id,retries[1].data.order_id);
  assert.equal(await stock(cheap.offer_id),2);
  assert.equal((await a.call('checkout',{...intent,items:[other]})).status,409);
  const receipt = await a.call('orders/'+id);
  assert.equal(receipt.status,200);
  assert.equal(receipt.data.items[0].price_cents,cheap.price_cents);
  assert.match(receipt.data.items[0].code,/^DEMO-[a-f0-9]{32}$/);
  assert.equal((await b.call('orders/'+id)).status,404);
  assert.deepEqual((await b.call('orders')).data,[]);
  assert.equal((await a.call('orders')).data.length,1);

  // Leave one key on the second offer, then submit competing purchases on separate workers.
  for (let n=0;n<2;n++) assert.equal((await pay(a,[other])).status,201);
  const race = await Promise.all([pay(a,[other]),pay(b,[other])]);
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
  assert.equal(await stock(other.offer_id),0);
  const before = (await a.call('orders')).data.length;
  assert.equal((await pay(a,[cheap,other])).status,409);
  assert.equal(await stock(cheap.offer_id),2);
  assert.equal((await a.call('orders')).data.length,before);
});
