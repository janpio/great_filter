const {
  test,
  expect,
  mockApiResponses,
  seedExtensionState,
  clearExtensionState,
  sendMessageToActiveTab,
  waitForLastApiRequest,
} = require('./fixtures/extension-fixture');
const { loadReddit } = require('./helpers/site-fixtures');
const { isLiveMode } = require('./helpers/test-mode');

test.describe('Reddit smoke tests', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    // Always start from a clean slate and use the deterministic mock responses.
    await clearExtensionState(serviceWorker);
    await mockApiResponses(serviceWorker);
    await seedExtensionState(serviceWorker, {
      filteringEnabled: false,
      allowedTopics: ['block politics'],
      sendImages: true,
    });
  });

  test('filters feed items and includes media metadata', async ({ context, serviceWorker }) => {
    const page = await context.newPage();
    await loadReddit(page);

    // Kick off filtering using the current test topics and verify the extension acked it.
    const startResponse = await sendMessageToActiveTab(serviceWorker, {
      action: 'startFiltering',
      topics: ['block politics'],
    });
    expect(startResponse?.success).toBe(true);

    const totalPosts = await page.locator('shreddit-post[data-gf-state]').count();
    expect(totalPosts).toBeGreaterThan(0);

    const blockedPosts = await page.locator('shreddit-post[data-gf-state="blocked"]').count();
    expect(blockedPosts).toBeGreaterThan(0);

    const lastRequest = await waitForLastApiRequest(serviceWorker);
    expect(lastRequest).toBeDefined();
    expect(lastRequest.body).toBeDefined();

    const messageContent = lastRequest.body.messages?.[0]?.content;
    expect(messageContent).toBeDefined();

    const normalizedEntries = Array.isArray(messageContent)
      ? messageContent
      : [{ type: 'text', text: String(messageContent) }];

    // Vision payloads are only guaranteed in fixture mode because live posts vary.
    const mediaEntries = normalizedEntries.filter(entry => entry.type === 'image_url');
    if (!isLiveMode()) {
      expect(mediaEntries.length).toBeGreaterThan(0);
    }

    // Stop filtering and confirm the DOM returns to its unfiltered state.
    await sendMessageToActiveTab(serviceWorker, { action: 'stopFiltering' });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-gf-state]').length === 0
    );
  });
});
