// Optional browser regression check. Requires Playwright and a running local gateway.
// Only disposable objects under this run's unique prefix are created/deleted.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STORVEX_TEST_URL || 'http://localhost:8180';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('This mutating UI test must target a local gateway.');
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
  });
  const prefix = 'ui-tests/' + randomUUID() + '/';
  const created = [];
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const endpoint = (key) => base + '/api/objects/' + encodeURIComponent(key);
  const list = async () => (await (await page.request.get(base + '/api/objects')).json()).objects;
  const action = (name, key) => page.getByRole(name === 'Download' ? 'link' : 'button', { name: name + ' ' + key, exact: true });
  const closePreview = async () => {
    await page.keyboard.press('Escape');
    // The dialog's close event is queued; wait for its cleanup instead of racing it.
    await page.waitForFunction(() => !document.querySelector('#preview-dialog').open && document.querySelector('#preview-body').children.length === 0);
  };
  const upload = async (filename, bytes, mime) => {
    const key = prefix + filename;
    const response = await page.request.post(base + '/api/objects', {
      data: { key, data: bytes.toString('base64'), contentType: mime },
    });
    assert.equal(response.status(), 201, await response.text());
    created.push(key);
    return key;
  };
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const existing = (await list()).map((object) => object.key);
    await page.goto(base + '/#objects', { waitUntil: 'networkidle' });
    const textKey = prefix + 'report.html';
    const text = '<script>window.uploadExecuted=true</script>\nHello from Storvex.';
    await page.getByRole('button', { name: 'Upload object', exact: true }).first().click();
    await page.locator('#object-key').fill(textKey);
    await page.locator('#file-input').setInputFiles({ name: 'report.html', mimeType: 'text/html', buffer: Buffer.from(text) });
    await page.locator('#store-submit').click();
    created.push(textKey);
    await action('Preview', textKey).waitFor();
    await action('Preview', textKey).click();
    await page.waitForFunction(() => document.querySelector('#preview-body pre') !== null);
    assert.equal(await page.locator('#preview-body pre').textContent(), text);
    assert.equal(await page.evaluate(() => window.uploadExecuted), undefined);
    assert.equal(await page.locator('#preview-body script').count(), 0);
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await action('Download', textKey).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'report.html');
    assert.equal((await page.request.get(endpoint(textKey))).status(), 200);

    // Cancel must not mutate data, and should return keyboard focus to Delete.
    await action('Delete', textKey).click();
    assert.equal(await page.locator('#confirm-accept').textContent(), 'Delete object');
    assert.ok(await page.locator('#confirm-cancel').evaluate((element) => element === document.activeElement));
    await page.locator('#confirm-cancel').click();
    await page.waitForFunction(() => document.activeElement?.dataset.deleteKey !== undefined);
    assert.equal((await page.request.get(endpoint(textKey))).status(), 200);

    const pngKey = await upload('pixel.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64'), 'image/png');
    const binaryKey = await upload('archive.zip', Buffer.from([0, 255, 3, 1]), 'application/zip');
    await page.locator('#refresh-button').click();
    await action('Preview', pngKey).click();
    await page.waitForFunction(() => document.querySelector('#preview-body img')?.naturalWidth === 1);
    await closePreview();
    assert.equal(await page.locator('#preview-body img').count(), 0);
    await action('Preview', binaryKey).click();
    assert.match(await page.locator('#preview-status').textContent(), /not available/);
    assert.equal(await page.locator('#preview-download').getAttribute('href'), '/api/objects/' + encodeURIComponent(binaryKey));
    await closePreview();

    // A read error is presented inside the preview, without leaving the dialog busy.
    await page.route(endpoint(textKey), (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Read quorum unavailable' }) }));
    await action('Preview', textKey).click();
    await page.waitForFunction(() => document.querySelector('#preview-status').textContent.includes('Read quorum unavailable'));
    assert.equal(await page.locator('#preview-body').getAttribute('aria-busy'), null);
    await closePreview();
    await page.unroute(endpoint(textKey));

    // Closing a pending preview cancels it, and stale content cannot fill a later preview.
    let releaseRead;
    const waitRead = new Promise((resolve) => { releaseRead = resolve; });
    await page.route(endpoint(textKey), async (route) => {
      await waitRead;
      await route.fulfill({ status: 200, contentType: 'text/html', body: text }).catch(() => {});
    });
    await action('Preview', textKey).click();
    await closePreview();
    await action('Preview', pngKey).click();
    releaseRead();
    await page.waitForFunction(() => document.querySelector('#preview-body img')?.naturalWidth === 1);
    assert.equal(await page.locator('#preview-body pre').count(), 0);
    await closePreview();
    await page.unroute(endpoint(textKey));

    // Large files should not be fetched for preview, and actual bytes are bounded.
    const largeCatalog = (await list()).map((object) => object.key === pngKey ? { ...object, size: 11 * 1024 * 1024 } : object);
    await page.route(base + '/api/objects', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ objects: largeCatalog }) }));
    let largeReads = 0;
    const countLargeRead = (request) => { if (request.url() === endpoint(pngKey)) largeReads++; };
    page.on('request', countLargeRead);
    await page.locator('#refresh-button').click();
    await page.waitForFunction(() => !document.querySelector('#refresh-button').disabled);
    await action('Preview', pngKey).click();
    assert.match(await page.locator('#preview-status').textContent(), /exceeds the preview limit/);
    assert.equal(largeReads, 0);
    page.off('request', countLargeRead);
    await closePreview();
    await page.unroute(base + '/api/objects');
    await page.locator('#refresh-button').click();
    await page.waitForFunction(() => !document.querySelector('#refresh-button').disabled);
    await page.route(endpoint(textKey), (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'x'.repeat(2 * 1024 * 1024 + 1) }));
    await action('Preview', textKey).click();
    await page.waitForFunction(() => document.querySelector('#preview-status').textContent.includes('too large'));
    assert.equal(await page.locator('#preview-body pre').count(), 0);
    await closePreview();
    await page.unroute(endpoint(textKey));

    // A failed deletion must keep the row, restore its controls, and report the error.
    await page.route(endpoint(textKey), (route) => route.request().method() === 'DELETE'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Metadata quorum unavailable' }) })
      : route.continue());
    await action('Delete', textKey).click();
    await page.locator('#confirm-accept').click();
    await page.waitForFunction(() => !document.querySelector('#main').hasAttribute('aria-busy'));
    assert.ok(await action('Delete', textKey).isEnabled());
    assert.match(await page.locator('#toast-region').textContent(), /Metadata quorum unavailable/);
    assert.equal((await page.request.get(endpoint(textKey))).status(), 200);
    await page.unroute(endpoint(textKey));

    // A delayed pre-delete catalog snapshot must not resurrect a deleted row.
    const staleCatalog = await list();
    let releaseCatalog;
    let catalogStarted;
    const heldCatalog = new Promise((resolve) => { releaseCatalog = resolve; });
    const catalogSeen = new Promise((resolve) => { catalogStarted = resolve; });
    let heldOnce = false;
    await page.route(base + '/api/objects', async (route) => {
      if (heldOnce) return route.continue();
      heldOnce = true;
      catalogStarted();
      await heldCatalog;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ objects: staleCatalog }) });
    });
    await page.locator('#refresh-button').click();
    await catalogSeen;
    await action('Delete', textKey).click();
    await page.locator('#confirm-accept').click();
    await page.waitForFunction((key) => ![...document.querySelectorAll('[data-delete-key]')].some((element) => element.dataset.deleteKey === key), textKey);
    releaseCatalog();
    await page.waitForFunction(() => !document.querySelector('#main').hasAttribute('aria-busy'));
    await page.unroute(base + '/api/objects');
    assert.equal(await action('Preview', textKey).count(), 0);
    assert.equal((await page.request.get(endpoint(textKey))).status(), 404);
    assert.ok(await action('Delete', pngKey).isEnabled());

    // Delete another row via keyboard; retention is the default 24 hours.
    let tombstone;
    page.on('response', async (response) => {
      if (response.url() === endpoint(pngKey) && response.request().method() === 'DELETE') tombstone = (await response.json()).tombstone;
    });
    await action('Delete', pngKey).focus();
    await page.keyboard.press('Enter');
    await page.locator('#confirm-accept').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#main').hasAttribute('aria-busy'));
    assert.ok(Date.parse(tombstone.purgeAfter) > Date.now() + 23 * 3600000);
    assert.equal((await page.request.get(endpoint(pngKey))).status(), 404);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
    }
    const remaining = new Set((await list()).map((object) => object.key));
    for (const key of existing) assert.ok(remaining.has(key), 'Existing object preserved: ' + key);
    assert.deepEqual(errors, []);
    if (process.env.STORVEX_SCREENSHOT) await page.screenshot({ path: process.env.STORVEX_SCREENSHOT, fullPage: true });
    console.log('PASS: upload, safe text/image preview, download, cancellation, errors, stale responses, confirmed deletion, retention, keyboard access, and responsive layout.');
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    for (const key of created) {
      const response = await page.request.delete(endpoint(key));
      assert.ok([202, 404].includes(response.status()), 'Disposable object cleanup: ' + key);
    }
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
