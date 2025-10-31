const {
  test,
  expect,
  mockApiResponses,
  seedExtensionState,
  clearExtensionState,
  getStoredState,
  sendMessageToActiveTab,
  waitForLastApiRequest,
} = require('./fixtures/extension-fixture');
const { loadHackerNews } = require('./helpers/site-fixtures');

test.describe('Hacker News smoke tests', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    // Make sure tests start with known storage and mocked network behaviour.
    await clearExtensionState(serviceWorker);
    await mockApiResponses(serviceWorker);
    await seedExtensionState(serviceWorker, {
      filteringEnabled: false,
      allowedTopics: ['block politics'],
    });
  });

  test('filters story rows and restores state after DOM changes', async ({ context, serviceWorker }) => {
    const page = await context.newPage();
    await loadHackerNews(page);

    // Trigger filtering and confirm the content script acknowledged the request.
    const startResponse = await sendMessageToActiveTab(serviceWorker, {
      action: 'startFiltering',
      topics: ['block politics'],
    });
    expect(startResponse?.success).toBe(true);

    const containerCount = await page.evaluate(() => document.querySelectorAll('tr.athing').length);
    expect(containerCount).toBeGreaterThan(0);

    await page.waitForFunction(() => document.querySelector('tr.gf-blocked, tr.gf-allowed') !== null);

    const usage = await getStoredState(serviceWorker, ['globalApiRequestCount']);

    const totalRows = await page.locator('tr.gf-blocked, tr.gf-allowed').count();
    expect(totalRows).toBeGreaterThanOrEqual(2);

    const blockedRows = await page.locator('tr.gf-blocked').count();
    expect(blockedRows).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      document
        .querySelectorAll('tr.gf-blocked, tr.gf-allowed, tr.gf-waiting')
        .forEach(element => {
          element.classList.remove('gf-blocked', 'gf-allowed', 'gf-waiting');
        });
    });

    // The rerender logic should notice cleared classes and reapply the filtering state.
    await page.waitForFunction(() => {
      const elements = Array.from(document.querySelectorAll('tr'));
      return elements.some(el => el.classList.contains('gf-blocked'));
    });

    await waitForLastApiRequest(serviceWorker);

    const storage = await getStoredState(serviceWorker, ['globalApiRequestCount']);
    expect(storage.globalApiRequestCount).toBeGreaterThanOrEqual(2);
  });
});
