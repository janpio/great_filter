const ContentFilterTestUtils = require('./test-utils');

require('../shared/content-base.js');

let LessWrongContentFilter;

beforeAll(() => {
  ContentFilterTestUtils.loadScript('./content-scripts/lesswrong.js');
  LessWrongContentFilter = global.LessWrongContentFilter;
});

describe('LessWrong Content Filter', () => {
  let lesswrongHTML;

  beforeAll(() => {
    lesswrongHTML = ContentFilterTestUtils.loadHTML('lesswrong.html');
  });

  beforeEach(() => {
    ContentFilterTestUtils.setupDOM(lesswrongHTML);
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.get.mockClear();
  });

  describe('Post Extraction', () => {
    test('should extract LessWrong posts from HTML', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      
      const posts = content.filter(item => item.type === 'post');
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.length).toBe(2);
    });

    test('should extract correct post titles', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      const posts = content.filter(item => item.type === 'post');

      const expectedTitles = [
        "OpenAI Claims IMO Gold Medal",
        "Generalized Hangriness: A Standard Rationalist Stance Toward Emotions"
      ];

      expectedTitles.forEach(title => {
        expect(posts.some(post => post.title === title)).toBe(true);
      });
    });

    test('should find posts with correct structure', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      const posts = content.filter(item => item.type === 'post');

      ContentFilterTestUtils.expectBasicElementStructure(posts);
      
      posts.forEach(post => {
        expect(post.container.tagName.toLowerCase()).toBe('span');
        expect(post.container.className).toMatch(/post_/);
        expect(post.type).toBe('post');
      });
    });

    test('should extract posts using multiple selectors', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      const posts = content.filter(item => item.type === 'post');

      expect(posts.length).toBeGreaterThan(0);
      
      posts.forEach(post => {
        const titleElement = post.container.querySelector('.PostsTitle-root a span, .LWPostsItem-title a span');
        expect(titleElement).toBeTruthy();
        expect(titleElement.textContent.trim()).toBe(post.title);
      });
    });
  });

  describe('Quick Take Extraction', () => {
    test('should extract LessWrong quick takes from HTML', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      
      const quickTakes = content.filter(item => item.type === 'quick_take');
      expect(quickTakes.length).toBeGreaterThan(0);
      expect(quickTakes.length).toBe(3);
    });

    test('should extract quick take content correctly', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      const quickTakes = content.filter(item => item.type === 'quick_take');

      const expectedContent = [
        "If you're considering a career in AI policy, now is an especially good time to start applying widely as there's a lot of hiring going on right now",
        "random thoughts, all of which may be wrong\n\none thing that I think the world needs more of is analyses into the nature of the mind by people who are both",
        "Epistemic status: Probably a terrible idea, but fun to think about, so I'm writing my thoughts down as I go.\n\nHere's a whimsical simple AGI governance"
      ];

      expectedContent.forEach(expectedText => {
        expect(quickTakes.some(qt => qt.title.includes(expectedText))).toBe(true);
      });
    });

    test('should find quick takes with correct structure', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      const quickTakes = content.filter(item => item.type === 'quick_take');

      ContentFilterTestUtils.expectBasicElementStructure(quickTakes);
      
      quickTakes.forEach(quickTake => {
        expect(quickTake.container.className).toContain('LWQuickTakesCollapsedListItem-root');
        expect(quickTake.type).toBe('quick_take');
        expect(quickTake.title.length).toBeGreaterThan(20);
      });
    });

    test('should truncate quick take content to 150 characters', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      const quickTakes = content.filter(item => item.type === 'quick_take');

      quickTakes.forEach(quickTake => {
        expect(quickTake.title.length).toBeLessThanOrEqual(150);
      });
    });
  });

  describe('Content Filtering', () => {
    test('should not extract comments', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();

      const commentElements = document.querySelectorAll('.LWPopularComment-root');
      expect(commentElements.length).toBeGreaterThan(0);

      content.forEach(item => {
        expect(item.container.className).not.toContain('LWPopularComment-root');
      });
    });

    test('should extract both posts and quick takes', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();

      const posts = content.filter(item => item.type === 'post');
      const quickTakes = content.filter(item => item.type === 'quick_take');

      expect(posts.length).toBeGreaterThan(0);
      expect(quickTakes.length).toBeGreaterThan(0);
      expect(content.length).toBe(posts.length + quickTakes.length);
    });

    test('should return consistent content count', () => {
      const filter = new LessWrongContentFilter();
      
      const firstRun = filter.extractLessWrongContent();
      const secondRun = filter.extractLessWrongContent();
      
      expect(firstRun.length).toBeGreaterThan(0);
      expect(secondRun.length).toEqual(firstRun.length);
    });
  });

  describe('Filtering Integration', () => {
    test('should call processElementsBatch with extracted content', async () => {
      const filter = new LessWrongContentFilter();
      const topics = ['AI safety', 'rationality'];
      
      await ContentFilterTestUtils.testFilteringIntegration(
        filter, 
        'processLessWrongContentForFiltering', 
        topics
      );
    });

    test('should handle API errors gracefully', async () => {
      const filter = new LessWrongContentFilter();
      const topics = ['technology'];
      
      await ContentFilterTestUtils.testErrorHandling(
        filter,
        'processLessWrongContentForFiltering',
        topics
      );
    });

    test('should process content with correct element type', async () => {
      const filter = new LessWrongContentFilter();
      const mockAPI = ContentFilterTestUtils.createMockAPI();
      
      chrome.runtime.sendMessage.mockResolvedValue(
        mockAPI.mixedResponse()
      );

      await filter.processLessWrongContentForFiltering(['AI safety', 'rationality']);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'checkVideoTitlesBatch',
          videos: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('OpenAI')
            })
          ]),
          topics: ['AI safety', 'rationality']
        })
      );
    });
  });

  describe('LessWrong-Specific Features', () => {
    test('should handle post containers with class patterns', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();
      const posts = content.filter(item => item.type === 'post');

      const postContainers = document.querySelectorAll('span[class*="post_"]');
      expect(posts.length).toBe(postContainers.length);
      
      posts.forEach(post => {
        expect(post.container.className).toMatch(/post_/);
      });
    });

    test('should extract content from different authors', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();

      const expectedAuthors = ['Peter Wildeford', 'leogao', 'Daniel Kokotajlo', 'Mikhail Samin', 'johnswentworth'];
      
      const authorElements = document.querySelectorAll('.UsersNameDisplay-noColor');
      const foundAuthors = Array.from(authorElements).map(el => el.textContent.trim());
      
      expectedAuthors.forEach(author => {
        expect(foundAuthors).toContain(author);
      });
    });

    test('should handle various content types', () => {
      const filter = new LessWrongContentFilter();
      const content = filter.extractLessWrongContent();

      const types = [...new Set(content.map(item => item.type))];
      expect(types).toContain('post');
      expect(types).toContain('quick_take');
      expect(types.length).toBe(2);
    });
  });
});