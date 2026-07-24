import 'dotenv/config';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const storefrontUrl = 'http://localhost:8080';
const adminUrl = 'http://localhost:3200';
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

assert(adminPassword, 'SEED_ADMIN_PASSWORD is required for the admin browser smoke test');

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const storefrontContext = await browser.newContext();
  const storefront = await storefrontContext.newPage();
  const storefrontApiFailures = [];
  storefront.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()));
  storefront.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
  storefront.on('response', async (response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) {
      const errStr = `${response.status()} ${response.request().method()} ${response.url()}`;
      storefrontApiFailures.push(errStr);
      try {
        const text = await response.text();
        console.error('API RESPONSE ERROR:', errStr, '\nPayload:', text);
      } catch {
        console.error('API RESPONSE ERROR:', errStr);
      }
    }
  });

  await storefront.goto(storefrontUrl);
  await storefront.evaluate(() => localStorage.clear());

  // --- 1. CATALOG FILTERS SMOKE TESTS ---
  await storefront.goto(`${storefrontUrl}/products`);
  await storefront.waitForSelector('input[placeholder*="ابحث"]');

  // Search filter
  await storefront.fill('input[placeholder*="ابحث"]', 'تي شيرت');
  await storefront.waitForTimeout(500); // Wait for debounce
  assert(storefront.url().includes('search='), 'URL did not update with search parameter');

  // Brand filter
  await storefront.selectOption('select:has-text("جميع الماركات")', { label: 'Velo Activewear' });
  await storefront.waitForTimeout(500);
  assert(storefront.url().includes('brandSlug=velo-activewear'), 'URL did not update with brand slug');

  // Price range
  await storefront.fill('input[placeholder="من"]', '50');
  await storefront.fill('input[placeholder="إلى"]', '500');
  await storefront.waitForTimeout(500);
  assert(storefront.url().includes('minPrice=50'), 'URL did not update with min price');
  assert(storefront.url().includes('maxPrice=500'), 'URL did not update with max price');

  // In stock only
  await storefront.click('input[id="inStockOnly"]');
  await storefront.waitForTimeout(500);
  assert(storefront.url().includes('inStockOnly=true'), 'URL did not update with inStockOnly');

  // Sorting
  await storefront.selectOption('select:has-text("الأحدث أولاً")', { value: 'price_asc' });
  await storefront.waitForTimeout(500);
  assert(storefront.url().includes('sortBy=price_asc'), 'URL did not update with sortBy');

  // Reload page and verify filters persist
  const filterUrl = storefront.url();
  await storefront.reload();
  await storefront.waitForSelector('input[placeholder*="ابحث"]');
  assert.equal(storefront.url(), filterUrl, 'URL did not persist filters after page reload');

  // Clear filters
  await storefront.click('button:has-text("إعادة ضبط")');
  await storefront.waitForTimeout(500);
  assert(!storefront.url().includes('search='), 'Filters were not cleared from URL');

  // --- 2. VARIANT SELECTION SMOKE TESTS ---
  const teeCard = storefront.locator('a[href^="/products/"]:has-text("تي شيرت")');
  await teeCard.waitFor();
  await teeCard.click();
  await storefront.waitForSelector('button:has-text("M")');

  // Click variants and verify selection
  await storefront.click('button:has-text("Black")');
  await storefront.click('button:has-text("M")');
  await storefront.waitForSelector('span:has-text("متوفر")');

  // Add selected variant to cart
  await storefront.click('button:has-text("إضافة للسلة")');
  await storefront.waitForURL('**/cart');

  // Verify cart details
  let cartItems = await storefront.evaluate(() =>
    JSON.parse(localStorage.getItem('nexio_cart') ?? '[]'),
  );
  assert.equal(cartItems.length, 1, 'Cart does not contain resolved variant item');
  assert(cartItems[0].variantId, 'Cart item is missing variantId');

  // --- 3. QUICK ADD SMOKE TESTS ---
  await storefront.goto(`${storefrontUrl}/products`);
  const sneakerCard = storefront.locator('a[href^="/products/"]:has-text("حذاء الجري")');
  await sneakerCard.waitFor();

  const addDialogPromise = new Promise((resolve) => {
    storefront.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.accept();
    });
  });
  await sneakerCard.locator('button[title="إضافة للسلة"]').click();
  await addDialogPromise;

  // --- 4. CHECKOUT & ORDER CREATION SMOKE TESTS ---
  await storefront.goto(`${storefrontUrl}/checkout`);
  const checkoutInputs = storefront.locator('form input');
  assert.equal(await checkoutInputs.count(), 4, 'Unexpected checkout form shape');
  await checkoutInputs.nth(0).fill('Nexio Browser Smoke');
  await checkoutInputs.nth(1).fill('07701234567');
  await checkoutInputs.nth(2).fill('Baghdad');
  await checkoutInputs.nth(3).fill('14 Ramadan Street');

  const orderDialogPromise = new Promise((resolve) => {
    storefront.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.accept();
    });
  });
  const orderResponsePromise = storefront.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/orders/checkout') && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await storefront.locator('button[type="submit"]').click();
  const orderResponse = await orderResponsePromise;
  if (!orderResponse.ok()) {
    throw new Error(
      `Order creation returned ${orderResponse.status()}: ${await orderResponse.text()}`,
    );
  }
  const createdOrder = await orderResponse.json();
  assert(createdOrder.orderNumber, 'Order creation response has no order number');
  await orderDialogPromise;
  await storefront.waitForURL('**/track-order');
  assert.equal(
    await storefront.evaluate(() => localStorage.getItem('nexio_cart')),
    null,
    'Cart was not cleared after order creation',
  );
  assert.deepEqual(storefrontApiFailures, [], 'Storefront emitted failed API responses');
  await storefrontContext.close();

  // --- 5. ADMIN ORDER VERIFICATION ---
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const adminApiFailures = [];
  admin.on('response', (response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) {
      adminApiFailures.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  await admin.goto(`${adminUrl}/login`);
  const loginInputs = admin.locator('form input');
  assert.equal(await loginInputs.count(), 3, 'Unexpected admin login form shape');
  await loginInputs.nth(0).fill('velo');
  await loginInputs.nth(1).fill('admin@veloactivewear.com');
  await loginInputs.nth(2).fill(adminPassword);

  const loginResponsePromise = admin.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST',
  );
  await admin.locator('button[type="submit"]').click();
  const loginResponse = await loginResponsePromise;
  assert(loginResponse.ok(), `Admin login returned ${loginResponse.status()}`);
  await admin.waitForURL(`${adminUrl}/`);
  assert(
    await admin.evaluate(() => Boolean(localStorage.getItem('access_token'))),
    'Admin access token was not stored',
  );

  const adminProductsResponsePromise = admin.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/products') && response.request().method() === 'GET',
  );
  await admin.goto(`${adminUrl}/products`);
  const adminProductsResponse = await adminProductsResponsePromise;
  assert(adminProductsResponse.ok(), `Admin products returned ${adminProductsResponse.status()}`);
  await admin.locator('tbody tr').first().waitFor();

  const adminOrdersResponsePromise = admin.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/orders') && response.request().method() === 'GET',
  );
  await admin.goto(`${adminUrl}/orders`);
  const adminOrdersResponse = await adminOrdersResponsePromise;
  assert(adminOrdersResponse.ok(), `Admin orders returned ${adminOrdersResponse.status()}`);
  await admin.getByText(createdOrder.orderNumber, { exact: true }).waitFor();
  assert.deepEqual(adminApiFailures, [], 'Admin emitted failed API responses');
  await adminContext.close();

  console.log(
    JSON.stringify({
      status: 'passed',
      storefront: ['products', 'cart', 'checkout', 'order creation', 'filters', 'variant selection'],
      admin: ['login', 'products', 'orders'],
      orderNumber: createdOrder.orderNumber,
    }),
  );
} finally {
  await browser.close();
}
