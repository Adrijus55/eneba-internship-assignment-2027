import assert from 'node:assert/strict';
import test from 'node:test';

const base = process.env.STORE_TEST_URL;
test('catalog searches, filters, sorts, and supplies independently sourced homepage blocks', { skip: !base }, async () => {
  async function get(path) {
    const response = await fetch(base + '/api/' + path, { headers: { Accept: 'application/json' } });
    assert.equal(response.status, 200, path);
    return response.json();
  }

  const [banner, bestSellers, deals, filters, all] = await Promise.all([
    get('home/banner'), get('home/best-sellers'), get('home/deals'), get('products/filters'), get('products'),
  ]);
  assert(banner.title && banner.description && banner.button_label);
  assert(all.length >= 8);
  assert(bestSellers.length > 0 && bestSellers.every(product => product.price_cents > 0));
  assert(deals.length > 0 && deals.every(product => product.price_cents < product.list_price_cents));
  assert(filters.platforms.includes('Steam') && filters.regions.includes('Global'));

  for (const q of ['orb cour', 'ORBIT COURIER', 'oribt courer']) {
    const products = await get('products?q=' + encodeURIComponent(q));
    assert.equal(products[0]?.name, 'Orbit Courier', q);
  }
  assert.deepEqual(await get('products?q=zzzzz'), []);
  assert.deepEqual(await get('products?q=%25'), []);

  const query = 'products?platform=Steam&region=Global&min_price=300&max_price=1200&sort=';
  const ascending = await get(query + 'price_asc');
  const descending = await get(query + 'price_desc');
  assert(ascending.length >= 2);
  assert(ascending.every(p => p.platform === 'Steam' && p.region === 'Global' && p.price_cents >= 300 && p.price_cents <= 1200));
  const prices = ascending.map(p => p.price_cents);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  assert.deepEqual(descending.map(p => p.price_cents), [...prices].reverse());
  const invalid = await fetch(base + '/api/products?min_price=500&max_price=100', { headers: { Accept: 'application/json' } });
  assert.equal(invalid.status, 422);
});
