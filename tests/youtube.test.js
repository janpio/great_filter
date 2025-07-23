const ContentFilterTestUtils = require('./test-utils');

require('../shared/content-base.js');

let YouTubeContentFilter;

beforeAll(() => {
  ContentFilterTestUtils.loadScript('./content-scripts/youtube.js');
  YouTubeContentFilter = global.YouTubeContentFilter;
});

describe('YouTube Content Filter', () => {
  let youtubeHTML;

  beforeAll(() => {
    youtubeHTML = ContentFilterTestUtils.loadHTML('youtube.html');
  });

  beforeEach(() => {
    ContentFilterTestUtils.setupDOM(youtubeHTML);
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.get.mockClear();
  });

  describe('Video Extraction', () => {
    test('should extract video titles from YouTube HTML', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBe(9); // 3 regular videos + 6 shorts (each short has 2 containers)
    });

    test('should extract correct video titles', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      const expectedTitles = [
        "Extended Highlights - Stage 13 - Tour de France 2025",
        "All The Ghosts You Will Be",
        "all killer, no filler"
      ];

      expectedTitles.forEach(title => {
        expect(items.some(item => item.title === title)).toBe(true);
      });
    });

    test('should find video elements using correct selectors', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      ContentFilterTestUtils.expectBasicElementStructure(items);

      items.forEach(item => {
        expect(item.title.length).toBeGreaterThan(5);
        expect(item.titleElement).toBeDefined();
        expect(item.usedSelector).toBeDefined();
        expect(item.container).toBeDefined();
      });
    });

    test('should return consistent video count', () => {
      const filter = new YouTubeContentFilter();

      const firstRun = filter.extractItemElements();
      const secondRun = filter.extractItemElements();

      expect(firstRun.length).toBeGreaterThan(0);
      expect(secondRun.length).toEqual(firstRun.length);
    });

    test('should find videos with correct container structure', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      // Filter for regular videos only (not shorts)
      const regularItems = items.filter(item =>
        item.container.matches('ytd-rich-grid-media')
      );

      expect(regularItems.length).toBe(3);
      regularItems.forEach(item => {
        expect(item.container.matches('ytd-rich-grid-media')).toBe(true);
        expect(item.titleElement.id).toBe('video-title');
      });
    });
  });

  describe('Filtering Integration', () => {
    test('should call processElementsBatch with extracted videos', async () => {
      const filter = new YouTubeContentFilter();
      const topics = ['technology', 'cycling'];

      await ContentFilterTestUtils.testFilteringIntegration(
        filter,
        'processItemsForFiltering',
        topics
      );
    });

    test('should handle API errors gracefully', async () => {
      const filter = new YouTubeContentFilter();
      const topics = ['sports'];

      await ContentFilterTestUtils.testErrorHandling(
        filter,
        'processItemsForFiltering',
        topics
      );
    });

    test('should process videos with correct element type', async () => {
      const filter = new YouTubeContentFilter();
      const mockAPI = ContentFilterTestUtils.createMockAPI();

      chrome.runtime.sendMessage.mockResolvedValue(
        mockAPI.mixedResponse()
      );

      await filter.processItemsForFiltering(['cycling', 'entertainment']);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'checkItemTitlesBatch',
          items: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('Tour de France')
            })
          ]),
          topics: ['cycling', 'entertainment']
        })
      );
    });
  });

  describe('YouTube-Specific Features', () => {
    test('should handle ytd-rich-grid-media containers', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      const gridMediaElements = document.querySelectorAll('ytd-rich-grid-media');
      const regularItems = items.filter(item =>
        item.container.matches('ytd-rich-grid-media')
      );

      expect(regularItems.length).toBe(gridMediaElements.length);
      regularItems.forEach(item => {
        expect(item.container.matches('ytd-rich-grid-media')).toBe(true);
      });
    });

    test('should extract videos from different video types', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      const expectedVideoTypes = ['cycling', 'entertainment', 'music'];

      items.forEach(item => {
        expect(item.title).toBeTruthy();
        expect(item.title.length).toBeGreaterThan(0);
      });
    });

    test('should handle yt-formatted-string title elements', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      // Filter for regular videos only (not shorts)
      const regularItems = items.filter(item =>
        item.container.matches('ytd-rich-grid-media')
      );

      regularItems.forEach(item => {
        expect(item.titleElement.id).toBe('video-title');
        expect(item.titleElement.tagName.toLowerCase()).toBe('yt-formatted-string');
      });
    });

    test('should find specific video titles mentioned by user', () => {
      const filter = new YouTubeContentFilter();
      const items = filter.extractItemElements();

      const userMentionedTitles = [
        "All The Ghosts You Will Be"
      ];

      userMentionedTitles.forEach(title => {
        expect(items.some(item => item.title === title)).toBe(true);
      });
    });
  });

  describe('YouTube Shorts Detection', () => {
    test('should detect YouTube Shorts elements in DOM', () => {
      const shortsElements = document.querySelectorAll('ytm-shorts-lockup-view-model');
      expect(shortsElements.length).toBeGreaterThan(0);
      expect(shortsElements.length).toBe(3);
    });

    test('should find specific shorts titles', () => {
      const shortsElements = document.querySelectorAll('.yt-core-attributed-string');
      const shortsTitle = Array.from(shortsElements).map(el => el.textContent.trim());

      const expectedShortsTitle = [
        "How much time does Tadej Pogačar spend training in Zone 2?",
        "Confronting Ronaldo",
        '"I did not like that. But it\'s modern cycling" 👀 Tadej Pogacar wasn\'t happy with Visma\'s strategy 🤔'
      ];

      expectedShortsTitle.forEach(title => {
        expect(shortsTitle).toContain(title);
      });
    });

    test('should detect shorts URLs', () => {
      const shortsLinks = document.querySelectorAll('a[href^="/shorts/"]');
      expect(shortsLinks.length).toBeGreaterThan(0);
      expect(shortsLinks.length).toBe(6); // 2 links per short (thumbnail + title)
    });

    test('should find user mentioned shorts title', () => {
      const shortsElements = document.querySelectorAll('.yt-core-attributed-string');
      const shortsTitle = Array.from(shortsElements).map(el => el.textContent.trim());

      expect(shortsTitle).toContain("Confronting Ronaldo");
    });
  });
});