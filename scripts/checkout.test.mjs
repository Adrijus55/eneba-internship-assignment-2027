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

test('catalog prices follow remaining stock and only the buyer receives keys', {skip: !first || !second}, async () => {
  const owner = await buyer(first);
  const observer = await buyer(second);
  async function publicData(path) {
    const response = await fetch(first + '/api/' + path, {headers: {Accept: 'application/json'}});
    assert.equal(response.status, 200, path);
    const data = await response.json();
    assert.ok(!/DEMO-|"(?:code|digital_key_id)"\s*:/.test(JSON.stringify(data)), 'Unexpected key data in ' + path);
    return data;
  }
  const path = 'products/2';
  const product = await publicData(path);
  const [cheap, expensive] = product.offers;
  const ranked = () => publicData('products?sort=price_asc');
  const position = rows => rows.findIndex(row => row.id === product.id);
  const before = await ranked();
  assert.equal(before[position(before)].price_cents, cheap.price_cents);

  async function sellOut(offer) {
    let lastAttempt;
    let lastOrder;
    assert.equal(offer.available_keys, 3);
    for (let i = 0; i < offer.available_keys; i++) {
      lastAttempt = {request_id: randomUUID(), items: [{offer_id: offer.id, price_cents: offer.price_cents}]};
      const result = await owner.call('checkout', lastAttempt);
      assert.equal(result.status, 201);
      assert.deepEqual(Object.keys(result.data), ['order_id']);
      lastOrder = result.data.order_id;
    }
    const retry = await owner.call('checkout', lastAttempt);
    assert.equal(retry.status, 200);
    assert.equal(retry.data.order_id, lastOrder);
    assert.equal((await publicData('offers/' + offer.id)).available_keys, 0);
    return lastOrder;
  }

  await sellOut(cheap);
  const after = await ranked();
  assert.equal(after[position(after)].price_cents, expensive.price_cents);
  assert.ok(position(after) > position(before));
  const orderId = await sellOut(expensive);
  for (const sort of ['price_asc', 'price_desc']) {
    const rows = await publicData('products?sort=' + sort);
    assert.equal(rows.at(-1).id, product.id);
    assert.equal(rows.at(-1).price_cents, null);
  }
  for (const endpoint of ['products?min_price=0', 'home/best-sellers', 'home/deals']) {
    assert.ok(!(await publicData(endpoint)).some(row => row.id === product.id), endpoint);
  }
  for (const endpoint of ['home/banner', 'products/filters', path]) await publicData(endpoint);
  const receiptPath = 'orders/' + orderId;
  const guest = await fetch(first + '/api/' + receiptPath, {headers: {Accept: 'application/json'}});
  assert.equal(guest.status, 401);
  const denied = await observer.call(receiptPath);
  assert.equal(denied.status, 404);
  assert.ok(!JSON.stringify(denied.data).includes('DEMO-'));
  assert.deepEqual((await observer.call('orders')).data, []);
  const history = (await owner.call('orders')).data;
  assert.equal(history.length, 6);
  assert.ok(!JSON.stringify(history).includes('DEMO-'));
  const codes = new Set();
  for (const order of history) {
    const receipt = await owner.call('orders/' + order.id);
    assert.equal(receipt.status, 200);
    const code = receipt.data.items[0].code;
    assert.ok(/^DEMO-[a-f0-9]{32}$/.test(code));
    codes.add(code);
  }
  assert.equal(codes.size, history.length);
});
