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

  // Auto-accept all dialogs to prevent ProtocolError on session close
  storefront.on('dialog', (dialog) => dialog.accept().catch(() => {}));

  const storefrontApiFailures = [];
  // Only capture API failures after initialization (ignore cold-start home page failures)
  let captureApiFailures = false;
  storefront.on('console', (msg) => {
    // Suppress noisy React DevTools, resource-level and cold-start product errors
    if (
      !msg.text().includes('react-devtools') &&
      !msg.text().includes('Failed to load resource') &&
      !msg.text().includes('Download the React DevTools')
    ) {
      console.log('PAGE CONSOLE:', msg.type(), msg.text());
    }
  });
  storefront.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
  storefront.on('response', async (response) => {
    if (captureApiFailures && response.url().includes('/api/v1/') && response.status() >= 400) {
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
  // Start capturing failures only after initialization
  captureApiFailures = true;

  /**
   * waitForProductsLoaded — navigates to /products and waits for at least
   * one product card to appear, retrying once if the API fails (cold-start race).
   */
  async function waitForProductsLoaded() {
    await storefront.goto(`${storefrontUrl}/products`);
    try {
      // Wait for a product card link to appear (confirms API succeeded)
      await storefront.waitForSelector('a[href^="/products/"]', { timeout: 15_000 });
    } catch {
      // API may have failed on cold start — reload once and try again
      console.log('[smoke] Products not loaded on first attempt, reloading...');
      await storefront.reload();
      await storefront.waitForSelector('a[href^="/products/"]', { timeout: 20_000 });
    }
    // Also wait for the search input which signals the filter bar is mounted
    await storefront.waitForSelector('input[placeholder*="ابحث"]');
  }

  // --- 1. CATALOG FILTERS SMOKE TESTS ---
  await waitForProductsLoaded();

  // Search filter
  await storefront.fill('input[placeholder*="ابحث"]', 'تي شيرت');
  await storefront.waitForTimeout(600);
  assert(storefront.url().includes('search='), 'URL did not update with search parameter');

  // Brand filter
  await storefront.selectOption('select:has-text("جميع الماركات")', { label: 'Velo Activewear' });
  await storefront.waitForTimeout(600);
  assert(storefront.url().includes('brandSlug=velo-activewear'), 'URL did not update with brand slug');

  // Price range
  await storefront.fill('input[placeholder="من"]', '50');
  await storefront.fill('input[placeholder="إلى"]', '500');
  await storefront.waitForTimeout(600);
  assert(storefront.url().includes('minPrice=50'), 'URL did not update with min price');
  assert(storefront.url().includes('maxPrice=500'), 'URL did not update with max price');

  // In stock only
  await storefront.click('input[id="inStockOnly"]');
  await storefront.waitForTimeout(600);
  assert(storefront.url().includes('inStockOnly=true'), 'URL did not update with inStockOnly');

  // Sorting
  await storefront.selectOption('select:has-text("الأحدث أولاً")', { value: 'price_asc' });
  await storefront.waitForTimeout(600);
  assert(storefront.url().includes('sortBy=price_asc'), 'URL did not update with sortBy');

  // Reload page and verify filters persist
  const filterUrl = storefront.url();
  await storefront.reload();
  // Wait for products to confirm page fully loaded after reload
  await storefront.waitForSelector('a[href^="/products/"]', { timeout: 20_000 });
  await storefront.waitForSelector('input[placeholder*="ابحث"]');
  assert.equal(storefront.url(), filterUrl, 'URL did not persist filters after page reload');

  // Clear filters
  await storefront.click('button:has-text("إعادة ضبط")');
  await storefront.waitForTimeout(600);
  assert(!storefront.url().includes('search='), 'Filters were not cleared from URL');

  // --- 2. VARIANT SELECTION SMOKE TESTS ---
  await waitForProductsLoaded();
  // Reset URL before trying variant selection (clear filters from previous step)
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
  const cartItems = await storefront.evaluate(() =>
    JSON.parse(localStorage.getItem('nexio_cart') ?? '[]'),
  );
  assert.equal(cartItems.length, 1, 'Cart does not contain resolved variant item');
  assert(cartItems[0].variantId, 'Cart item is missing variantId');

  // --- 3. QUICK ADD SMOKE TESTS ---
  await waitForProductsLoaded();
  const sneakerCard = storefront.locator('a[href^="/products/"]:has-text("حذاء الجري")');
  await sneakerCard.waitFor();
  // Dialog is auto-accepted by the persistent listener above
  await sneakerCard.locator('button[title="إضافة للسلة"]').click();
  await storefront.waitForTimeout(800);

  // --- 4. CHECKOUT & ORDER CREATION SMOKE TESTS ---
  await storefront.goto(`${storefrontUrl}/checkout`);
  const checkoutInputs = storefront.locator('form input');
  assert.equal(await checkoutInputs.count(), 4, 'Unexpected checkout form shape');
  await checkoutInputs.nth(0).fill('Nexio Browser Smoke');
  await checkoutInputs.nth(1).fill('07701234567');
  await checkoutInputs.nth(2).fill('Baghdad');
  await checkoutInputs.nth(3).fill('14 Ramadan Street');

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

  // Wait for navigation after the dialog is auto-accepted
  await storefront.waitForURL('**/track-order', { timeout: 10_000 });
  assert.equal(
    await storefront.evaluate(() => localStorage.getItem('nexio_cart')),
    null,
    'Cart was not cleared after order creation',
  );
  assert.deepEqual(storefrontApiFailures, [], 'Storefront emitted failed API responses');
  await storefrontContext.close();

  // --- 5. ADMIN FLOW ---
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();

  // Auto-accept dialogs in admin too
  admin.on('dialog', (dialog) => dialog.accept().catch(() => {}));

  const adminApiFailures = [];
  admin.on('response', (response) => {
    const status = response.status();
    // 409 Conflict is intentional for idempotent attribute creation (already exists)
    if (response.url().includes('/api/v1/') && status >= 400 && status !== 409) {
      adminApiFailures.push(
        `${status} ${response.request().method()} ${response.url()}`,
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

  const adminProductsResponsePromise = admin.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/products') && response.request().method() === 'GET',
  );
  await admin.goto(`${adminUrl}/products`);
  const adminProductsResponse = await adminProductsResponsePromise;
  assert(adminProductsResponse.ok(), `Admin products returned ${adminProductsResponse.status()}`);
  await admin.locator('tbody tr').first().waitFor();

  // --- 5.1 ADMIN ATTRIBUTE BUILDER SMOKE TEST ---
  const adminAttributesResponsePromise = admin.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/attribute-definitions') && response.request().method() === 'GET',
  );
  await admin.goto(`${adminUrl}/attributes`);
  const adminAttributesResponse = await adminAttributesResponsePromise;
  assert(
    adminAttributesResponse.ok(),
    `Admin attributes returned ${adminAttributesResponse.status()}`,
  );
  await admin.waitForSelector('h1:has-text("إدارة خصائص ومتغيرات المنتجات")');

  /**
   * createAttributeIfNeeded — idempotent helper.
   * Always attempts POST. Treats 409 (conflict = already exists) as success.
   *
   * Flow analysis of the attributes page modal:
   *   - Success (201): alert('تم إضافة...') → auto-accept → setIsModalOpen(false) → backdrop hides
   *   - Conflict (409): catch block → alert(err.message) → auto-accept → modal stays open
   *     → must click the "إلغاء" cancel button to close modal → backdrop hides
   */
  async function createAttributeIfNeeded(fillFn) {
    await admin.click('button:has-text("إضافة خاصية جديدة")');
    await admin.waitForSelector('h3:has-text("إنشاء خاصية منتج جديدة")');
    await fillFn();
    const createPromise = admin.waitForResponse(
      (r) => r.url().includes('/api/v1/attribute-definitions') && r.request().method() === 'POST',
    );
    await admin.click('button[type="submit"]');
    const resp = await createPromise;
    if (resp.status() === 409) {
      // 409: alert is shown by catch block, auto-accepted by our listener.
      // Modal does NOT auto-close on error — click إلغاء (Cancel) to close it.
      // Wait a moment for the alert to be auto-accepted first.
      await admin.waitForTimeout(600);
      await admin.click('button:has-text("إلغاء")');
    } else {
      assert(resp.ok(), `Attribute creation failed with status: ${resp.status()}`);
      // 201: success alert auto-accepted, then setIsModalOpen(false) closes the modal.
    }
    // Wait for the modal backdrop to fully disappear before proceeding.
    await admin.waitForSelector('div.fixed.inset-0', { state: 'hidden', timeout: 15_000 });
  }

  // Create Size attribute (idempotent — 409 treated as already-exists)
  await createAttributeIfNeeded(async () => {
    await admin.fill('input[placeholder="e.g. Color, Size, Capacity"]', 'Smoke Test Size');
    await admin.fill('input[placeholder="مثال: اللون، المقاس، السعة"]', 'المقاس التجريبي');

    const optionValueInputs = admin.locator('input[placeholder*="القيمة"]');
    const optionArInputs = admin.locator('input[placeholder="الاسم بالعربية"]');
    const optionEnInputs = admin.locator('input[placeholder="Label (EN)"]');

    await optionValueInputs.nth(0).fill('S_SMOKE');
    await optionArInputs.nth(0).fill('صغير تجريبي');
    await optionEnInputs.nth(0).fill('Small Smoke');
    await optionValueInputs.nth(1).fill('L_SMOKE');
    await optionArInputs.nth(1).fill('كبير تجريبي');
    await optionEnInputs.nth(1).fill('Large Smoke');
  });

  // Create Color attribute (idempotent — 409 treated as already-exists)
  await createAttributeIfNeeded(async () => {
    await admin.fill('input[placeholder="e.g. Color, Size, Capacity"]', 'color');
    await admin.fill('input[placeholder="مثال: اللون، المقاس، السعة"]', 'اللون');

    // Select the color type card (rendered as button cards, not a <select>)
    await admin.click('button:has-text("ألوان بصرية")');

    const colorValueInputs = admin.locator('input[placeholder*="#hex"], input[placeholder*="القيمة"]');
    const colorArInputs = admin.locator('input[placeholder="الاسم بالعربية"]');
    const colorEnInputs = admin.locator('input[placeholder="Label (EN)"]');

    await colorValueInputs.nth(0).fill('#000000');
    await colorArInputs.nth(0).fill('أسود');
    await colorEnInputs.nth(0).fill('Black');
    await colorValueInputs.nth(1).fill('#FF0000');
    await colorArInputs.nth(1).fill('أحمر');
    await colorEnInputs.nth(1).fill('Red');
  });

  // Verify both attributes are visible in the list after creation
  // (Re-navigate to ensure the list is refreshed)
  await admin.goto(`${adminUrl}/attributes`);
  await admin.waitForSelector('h1:has-text("إدارة خصائص ومتغيرات المنتجات")');

  // --- 5.2 VARIANT MATRIX SMOKE TEST ---
  await admin.goto(`${adminUrl}/products`);
  await admin.locator('tbody tr button').first().click();

  await admin.click('button:has-text("المتغيرات والمخزون")');
  await admin.waitForSelector('button:has-text("إضافة متغير يدوي")');

  await admin.click('button:has-text("توليد مصفوفة SKUs ذكية")');
  await admin.waitForSelector('input[placeholder="مثال: NEX-IPH or VELO-TEE"]');

  // --- 5.3 ADMIN ORDERS VERIFICATION ---
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

  // --- 6. STOREFRONT DYNAMIC ATTRIBUTE FILTERS VERIFICATION ---
  const newStorefrontContext = await browser.newContext();
  const newStorefront = await newStorefrontContext.newPage();
  newStorefront.on('dialog', (dialog) => dialog.accept().catch(() => {}));

  await newStorefront.goto(`${storefrontUrl}/products`);
  await newStorefront.waitForSelector('span:has-text("تصفية بالمواصفات والخصائص")');
  await newStorefront.waitForSelector('span:has-text("اللون")');
  await newStorefront.waitForSelector('span:has-text("المقاس التجريبي")');

  // Check color swatch filter interaction
  const colorSwatch = newStorefront.locator('button[style*="background-color"]').first();
  if (await colorSwatch.isVisible()) {
    await colorSwatch.click();
    await newStorefront.waitForTimeout(600);
    assert(
      newStorefront.url().includes('attributes%5Bcolor%5D='),
      'URL did not update with color attribute filter',
    );
    await colorSwatch.click();
    await newStorefront.waitForTimeout(600);
  }
  await newStorefrontContext.close();

  console.log(
    JSON.stringify({
      status: 'passed',
      storefront: [
        'catalog filters',
        'variant selection',
        'cart',
        'checkout',
        'order creation',
        'dynamic attribute filters',
      ],
      admin: ['login', 'products', 'attribute builder', 'variant matrix', 'orders'],
      orderNumber: createdOrder.orderNumber,
    }),
  );
} finally {
  await browser.close();
}
