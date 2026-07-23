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
  storefront.on('response', (response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) {
      storefrontApiFailures.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  await storefront.goto(storefrontUrl);
  await storefront.evaluate(() => localStorage.clear());

  await storefront.goto(`${storefrontUrl}/products`);
  await storefront.waitForSelector('a[href^="/products/"]');

  const productCards = storefront.locator('a[href^="/products/"]');
  assert((await productCards.count()) > 1, 'Storefront rendered too few product cards');

  const addDialogPromise = new Promise((resolve) => {
    storefront.once('dialog', async (dialog) => {
      resolve(dialog.message());
      await dialog.accept();
    });
  });
  await productCards.nth(1).locator('button').click();
  await addDialogPromise;

  await storefront.goto(`${storefrontUrl}/cart`);
  const cart = await storefront.evaluate(() =>
    JSON.parse(localStorage.getItem('nexio_cart') ?? '[]'),
  );
  assert.equal(cart.length, 1, 'Cart did not retain the selected product');
  assert(
    await storefront.locator('a[href="/checkout"]').isVisible(),
    'Checkout link is not visible',
  );

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
      storefront: ['products', 'cart', 'checkout', 'order creation'],
      admin: ['login', 'products', 'orders'],
      orderNumber: createdOrder.orderNumber,
    }),
  );
} finally {
  await browser.close();
}
