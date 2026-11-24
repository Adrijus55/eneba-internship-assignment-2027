// Use a freshly migrated LOCAL database. This test buys all three keys from one demo offer.
// Select it with BROWSER_TEST_URL; Playwright and Chrome must be available to Node.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const test = require('node:test');

const base = process.env.BROWSER_TEST_URL;
test('guest cart through receipt, simultaneous tabs and last-key response loss', {skip: !base}, async t => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const browser = await require('playwright').chromium.launch({channel: 'chrome'});
  t.after(() => browser.close());
  const context = await browser.newContext({baseURL: base, viewport: {width: 360, height: 800}});
  context.setDefaultTimeout(10000);
  const page = await context.newPage();
  const desktop = await context.newPage();
  await desktop.setViewportSize({width: 1366, height: 768});
  const email = randomUUID() + '@example.test';
  const password = randomBytes(20).toString('hex');
  const game = 'Lantern Vale';
  const seller = 'Key Lantern';
  const confirm = 'Confirm simulated purchase';
  async function fits(p) {
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow: ' + p.url());
  }
  async function addOffer() {
    await page.goto('/products/3');
    const row = page.getByRole('listitem').filter({hasText: seller});
    await row.getByRole('button', {name: 'Add to cart'}).click();
    await page.getByRole('link', {name: 'Cart (1)'}).click();
    await page.getByText(seller, {exact: false}).waitFor();
  }
  async function signIn() {
    await page.getByRole('link', {name: 'Sign in', exact: true}).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', {exact: true}).fill(password);
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await page.waitForURL('**/cart');
  }
  await page.goto('/cart');
  await page.getByText('Your cart is empty.').waitFor();
  await page.getByRole('searchbox').fill('lantarn va');
  await page.getByRole('button', {name: 'Search', exact: true}).click();
  await page.getByRole('heading', {name: game}).waitFor();
  await page.getByLabel('Platform').selectOption('Xbox');
  await page.getByLabel('Region').selectOption('Global');
  await page.getByLabel('Min. price').fill('12');
  await page.getByLabel('Max. price').fill('10');
  await page.getByRole('button', {name: 'Apply filters'}).click();
  await page.getByRole('alert').filter({hasText: 'minimum price'}).waitFor();
  await page.getByLabel('Min. price').fill('5');
  await page.getByLabel('Sort by').selectOption('price_desc');
  await page.getByRole('button', {name: 'Apply filters'}).click();
  await page.waitForURL('**/*sort=price_desc');
  await page.getByRole('heading', {name: game}).click();
  await page.getByRole('listitem').filter({hasText: seller}).getByRole('button', {name: 'Add to cart'}).click();
  await page.getByRole('link', {name: 'Cart (1)'}).click();
  await page.reload();
  await page.getByText(seller, {exact: false}).waitFor();
  await page.getByRole('link', {name: 'Checkout', exact: true}).click();
  await page.getByRole('link', {name: 'Create an account'}).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', {exact: true}).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', {name: 'Create account'}).click();
  await page.waitForURL('**/cart');
  await page.getByText(seller, {exact: false}).waitFor();
  await desktop.goto('/orders');
  await desktop.getByText('You have no purchases yet.').waitFor();
  await desktop.goto('/checkout');
  await page.getByRole('link', {name: 'Checkout', exact: true}).click();
  for (const p of [page, desktop]) {
    await p.getByRole('button', {name: confirm}).waitFor();
    await fits(p);
  }
  // Click both ready buttons before either response reaches the browser.
  let received;
  const firstRequest = new Promise(resolve => { received = resolve; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await context.route('**/api/checkout', async route => {
    received();
    await gate;
    await route.continue();
  });
  await page.getByRole('button', {name: confirm}).click();
  await firstRequest;
  await desktop.getByRole('button', {name: confirm}).click();
  release();
  await page.waitForURL('**/orders/*');
  await page.locator('code').waitFor();
  await desktop.getByText('Your cart is empty.').waitFor();
  await context.unroute('**/api/checkout');
  await page.getByRole('link', {name: 'Order history'}).click();
  await page.getByRole('link', {name: /^Order #/}).first().waitFor();
  assert.equal(await page.getByRole('link', {name: /^Order #/}).count(), 1);

  await addOffer();
  await page.getByRole('link', {name: 'Checkout', exact: true}).click();
  await page.getByRole('button', {name: confirm}).click();
  await page.waitForURL('**/orders/*');
  await addOffer();
  await page.getByRole('link', {name: 'Checkout', exact: true}).click();
  let committed;
  const guest = await browser.newPage({baseURL: base});
  await guest.goto('/products/3');
  await guest.getByRole('listitem').filter({hasText: seller}).getByRole('button', {name: 'Add to cart'}).click();
  await page.route('**/api/checkout', async route => {
    const response = await route.fetch();
    assert.equal(response.status(), 201);
    committed = (await response.json()).order_id;
    await route.abort();
  }, {times: 1});
  await page.getByRole('button', {name: confirm}).click();
  await page.getByRole('alert').waitFor();
  await page.reload();
  await page.getByRole('button', {name: 'Recover previous receipt'}).click();
  await page.waitForURL('**/orders/' + committed);
  const delivered = await page.locator('code').innerText();
  assert.ok(/^DEMO-[a-f0-9]{32}$/.test(delivered));
  await fits(page);
  await page.getByRole('button', {name: 'Sign out'}).click();
  await signIn();
  await page.getByRole('link', {name: 'Order history'}).click();
  await page.getByRole('link', {name: 'Order #' + committed, exact: true}).click();
  assert.ok(await page.locator('code').innerText() === delivered);
  await page.getByRole('searchbox').fill('no-matching-game');
  await page.getByRole('button', {name: 'Search', exact: true}).click();
  await page.getByText('No games match your search and filters.').waitFor();
  await fits(page);
  await page.goto('/products/3');
  const soldOut = page.getByRole('listitem').filter({hasText: seller}).getByRole('button', {name: 'Sold out'});
  await soldOut.waitFor();
  assert.ok(await soldOut.isDisabled());
  await guest.goto('/cart');
  await guest.getByText(/Remove unavailable offers/).waitFor();
  assert.equal(await guest.getByRole('link', {name: 'Checkout', exact: true}).count(), 0);
});
