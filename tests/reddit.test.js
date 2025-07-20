const ContentFilterTestUtils = require('./test-utils');

require('../shared/content-base.js');

let RedditContentFilter;

beforeAll(() => {
  ContentFilterTestUtils.loadScript('./content-scripts/reddit.js');
  RedditContentFilter = global.RedditContentFilter;
});

describe('Reddit Content Filter', () => {
  let redditHTML;

  beforeAll(() => {
    redditHTML = ContentFilterTestUtils.loadHTML('reddit.html');
  });

  beforeEach(() => {
    ContentFilterTestUtils.setupDOM(redditHTML);
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.get.mockClear();
  });

  describe('Post Extraction', () => {
    test('should extract Reddit posts from HTML', () => {
      const filter = new RedditContentFilter();
      const posts = filter.extractRedditPosts();

      expect(posts.length).toBeGreaterThan(0);
      expect(posts.length).toBe(3);
    });

    test('should extract correct post titles', () => {
      const filter = new RedditContentFilter();
      const posts = filter.extractRedditPosts();

      const expectedTitles = [
        "The Bestest of Friends",
        "I cannot believe this happened during the SAMURAI concert yesterday",
        "Told the shepherds to hang back for a cyclist… somehow even the Jack Russell behaved."
      ];

      expectedTitles.forEach(title => {
        expect(posts.some(post => post.title === title)).toBe(true);
      });
    });

    test('should find posts with correct structure', () => {
      const filter = new RedditContentFilter();
      const posts = filter.extractRedditPosts();

      ContentFilterTestUtils.expectBasicElementStructure(posts);
      
      posts.forEach(post => {
        expect(post.container.tagName.toLowerCase()).toBe('shreddit-post');
        expect(post.container.getAttribute('post-title')).toBe(post.title);
      });
    });

    test('should use post-title attribute for extraction', () => {
      const filter = new RedditContentFilter();
      const posts = filter.extractRedditPosts();

      posts.forEach(post => {
        const postTitleAttr = post.container.getAttribute('post-title');
        expect(postTitleAttr).toBe(post.title);
        expect(postTitleAttr).toBeTruthy();
      });
    });

    test('should return consistent post count', () => {
      const filter = new RedditContentFilter();
      
      const firstRun = filter.extractRedditPosts();
      const secondRun = filter.extractRedditPosts();
      
      expect(firstRun.length).toBeGreaterThan(0);
      expect(secondRun.length).toEqual(firstRun.length);
    });
  });

  describe('Filtering Integration', () => {
    test('should call processElementsBatch with extracted posts', async () => {
      const filter = new RedditContentFilter();
      const topics = ['technology', 'gaming'];
      
      await ContentFilterTestUtils.testFilteringIntegration(
        filter, 
        'processRedditPostsForFiltering', 
        topics
      );
    });

    test('should handle API errors gracefully', async () => {
      const filter = new RedditContentFilter();
      const topics = ['technology'];
      
      await ContentFilterTestUtils.testErrorHandling(
        filter,
        'processRedditPostsForFiltering',
        topics
      );
    });

    test('should process posts with correct element type', async () => {
      const filter = new RedditContentFilter();
      const mockAPI = ContentFilterTestUtils.createMockAPI();
      
      chrome.runtime.sendMessage.mockResolvedValue(
        mockAPI.mixedResponse()
      );

      await filter.processRedditPostsForFiltering(['gaming', 'entertainment']);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'checkVideoTitlesBatch',
          videos: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('SAMURAI')
            })
          ]),
          topics: ['gaming', 'entertainment']
        })
      );
    });
  });

  describe('Reddit-Specific Features', () => {
    test('should handle shreddit-post containers', () => {
      const filter = new RedditContentFilter();
      const posts = filter.extractRedditPosts();

      const shredditPosts = document.querySelectorAll('shreddit-post');
      expect(posts.length).toBe(shredditPosts.length);
      
      posts.forEach(post => {
        expect(post.container.matches('shreddit-post')).toBe(true);
      });
    });

    test('should extract posts from different subreddits', () => {
      const filter = new RedditContentFilter();
      const posts = filter.extractRedditPosts();

      const expectedSubreddits = ['r/pics', 'r/cyberpunkgame', 'r/nextfuckinglevel'];
      
      posts.forEach(post => {
        const subreddit = post.container.getAttribute('subreddit-prefixed-name');
        expect(expectedSubreddits).toContain(subreddit);
      });
    });

    test('should handle various post types', () => {
      const filter = new RedditContentFilter();
      const posts = filter.extractRedditPosts();

      const postTypes = posts.map(post => 
        post.container.getAttribute('post-type')
      );

      expect(postTypes).toContain('image');
      expect(postTypes).toContain('gallery');
      expect(postTypes).toContain('video');
    });
  });
});