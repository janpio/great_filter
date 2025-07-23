const ContentFilterTestUtils = require('./test-utils');

require('../shared/content-base.js');

let HackerNewsContentFilter;

beforeAll(() => {
  ContentFilterTestUtils.loadScript('./content-scripts/hackernews.js');
  HackerNewsContentFilter = global.HackerNewsContentFilter;
});

describe('HackerNews Content Filter', () => {
  let hackerNewsHTML;

  beforeAll(() => {
    hackerNewsHTML = ContentFilterTestUtils.loadHTML('hackernews.html');
  });

  beforeEach(() => {
    ContentFilterTestUtils.setupDOM(hackerNewsHTML);
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.get.mockClear();
  });

  describe('Story Extraction', () => {
    test('should extract story titles from HackerNews HTML', () => {
      const filter = new HackerNewsContentFilter();
      const items = filter.extractItemElements();

      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(90);
      expect(items.length).toBeGreaterThanOrEqual(30);
    });

    test('should extract correct story titles', () => {
      const filter = new HackerNewsContentFilter();
      const items = filter.extractItemElements();

      const expectedTitles = [
        "I'm Peter Roberts, immigration attorney who does work for YC and startups. AMA",
        "lsr: ls with io_uring",
        "CP/M creator Gary Kildall's memoirs released as free download"
      ];

      expectedTitles.forEach(title => {
        expect(items.some(item => item.title === title)).toBe(true);
      });
    });

    test('should find title elements using correct selectors', () => {
      const filter = new HackerNewsContentFilter();
      const items = filter.extractItemElements();

      ContentFilterTestUtils.expectBasicElementStructure(items);
      
      items.forEach(item => {
        expect(item.title.length).toBeGreaterThan(5);
        expect(item.titleElement).toBeDefined();
        expect(item.usedSelector).toBeDefined();
      });
    });

    test('should return consistent story count', () => {
      const filter = new HackerNewsContentFilter();
      
      const firstRun = filter.extractItemElements();
      const secondRun = filter.extractItemElements();
      
      expect(firstRun.length).toBeGreaterThan(0);
      expect(secondRun.length).toEqual(firstRun.length);
    });

    test('should find stories with correct container structure', () => {
      const filter = new HackerNewsContentFilter();
      const items = filter.extractItemElements();

      items.forEach(item => {
        expect(item.container.classList.contains('athing')).toBe(true);
        expect(item.container.classList.contains('submission')).toBe(true);
      });
    });
  });

  describe('Filtering Integration', () => {
    test('should call processElementsBatch with extracted stories', async () => {
      const filter = new HackerNewsContentFilter();
      const topics = ['technology', 'programming'];
      
      await ContentFilterTestUtils.testFilteringIntegration(
        filter, 
        'processItemsForFiltering', 
        topics
      );
    });

    test('should handle API errors gracefully', async () => {
      const filter = new HackerNewsContentFilter();
      const topics = ['technology'];
      
      await ContentFilterTestUtils.testErrorHandling(
        filter,
        'processItemsForFiltering',
        topics
      );
    });
  });
});