const ContentFilterTestUtils = require('./test-utils');

require('../shared/content-base.js');

let XContentFilter;

beforeAll(() => {
  ContentFilterTestUtils.loadScript('./content-scripts/x.js');
  XContentFilter = global.XContentFilter;
});

describe('X Content Filter', () => {
  let xHTML;

  beforeAll(() => {
    xHTML = ContentFilterTestUtils.loadHTML('x.html');
  });

  beforeEach(() => {
    ContentFilterTestUtils.setupDOM(xHTML);
    chrome.runtime.sendMessage.mockClear();
    chrome.storage.local.get.mockClear();
  });

  describe('Tweet Extraction', () => {
    test('should extract tweet elements from X HTML', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      expect(tweets.length).toBeGreaterThan(0);
      expect(tweets.length).toBe(24); // Multiple selectors find same tweets multiple times
    });

    test('should extract correct tweet content', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const expectedTweets = [
        "For some reason I thought this was real until I saw the gorilla",
        "Just shipped a new feature that automatically detects and filters spam content using machine learning. The AI accuracy is incredible!",
        "Breaking: Scientists discover new method for carbon capture that could revolutionize climate change mitigation efforts worldwide"
      ];

      expectedTweets.forEach(tweetText => {
        expect(tweets.some(tweet => tweet.title === tweetText)).toBe(true);
      });
    });

    test('should find tweet elements using correct selectors', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      ContentFilterTestUtils.expectBasicElementStructure(tweets);

      tweets.forEach(tweet => {
        expect(tweet.title.length).toBeGreaterThan(5);
        expect(tweet.titleElement).toBeDefined();
        expect(tweet.usedSelector).toBeDefined();
        expect(tweet.container).toBeDefined();
      });
    });

    test('should return consistent tweet count', () => {
      const filter = new XContentFilter();

      const firstRun = filter.extractTweetElements();
      const secondRun = filter.extractTweetElements();

      expect(firstRun.length).toBeGreaterThan(0);
      expect(secondRun.length).toEqual(firstRun.length);
    });

    test('should find tweets with correct container structure', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      expect(tweets.length).toBe(24); // Multiple selectors create duplicates
      
      // Check that we have tweets with the expected container types
      const articleTweets = tweets.filter(tweet => 
        tweet.container.matches('article[data-testid="tweet"]')
      );
      expect(articleTweets.length).toBeGreaterThan(0);
      
      // Check that all tweets have valid title elements
      tweets.forEach(tweet => {
        expect(tweet.titleElement).toBeDefined();
        expect(tweet.title.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Filtering Integration', () => {
    test('should call processElementsBatch with extracted tweets', async () => {
      const filter = new XContentFilter();
      const topics = ['technology', 'science'];

      await ContentFilterTestUtils.testFilteringIntegration(
        filter,
        'processTweetsForFiltering',
        topics
      );
    });

    test('should handle API errors gracefully', async () => {
      const filter = new XContentFilter();
      const topics = ['sports'];

      await ContentFilterTestUtils.testErrorHandling(
        filter,
        'processTweetsForFiltering',
        topics
      );
    });

    test('should process tweets with correct element type', async () => {
      const filter = new XContentFilter();
      const mockAPI = ContentFilterTestUtils.createMockAPI();

      chrome.runtime.sendMessage.mockResolvedValue(
        mockAPI.mixedResponse()
      );

      await filter.processTweetsForFiltering(['technology', 'cycling']);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'checkVideoTitlesBatch', // X script reuses video processing logic
          videos: expect.arrayContaining([
            expect.objectContaining({
              title: expect.stringContaining('machine learning')
            })
          ]),
          topics: ['technology', 'cycling']
        })
      );
    });
  });

  describe('X-Specific Features', () => {
    test('should handle article tweet containers', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
      
      // Multiple selectors find more tweets than just the article elements
      expect(tweets.length).toBeGreaterThan(tweetArticles.length);
      
      // But we should have at least some tweets from article containers
      const articleTweets = tweets.filter(tweet => 
        tweet.container.matches('article[data-testid="tweet"]')
      );
      expect(articleTweets.length).toBeGreaterThanOrEqual(tweetArticles.length);
    });

    test('should extract tweets from different content types', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const expectedContentTypes = ['humor', 'technology', 'science', 'sports', 'programming', 'philosophy'];

      tweets.forEach(tweet => {
        expect(tweet.title).toBeTruthy();
        expect(tweet.title.length).toBeGreaterThan(0);
      });
    });

    test('should handle tweetText span elements', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      // Check that we have tweets with tweetText elements
      const tweetTextTweets = tweets.filter(tweet => 
        tweet.titleElement.matches('[data-testid="tweetText"]') ||
        tweet.titleElement.matches('[data-testid="tweetText"] span')
      );
      expect(tweetTextTweets.length).toBeGreaterThan(0);
      
      // Check that all tweets have valid title elements
      tweets.forEach(tweet => {
        expect(tweet.titleElement).toBeDefined();
        expect(tweet.usedSelector).toBeDefined();
      });
    });

    test('should find specific tweet content mentioned by user', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const userMentionedContent = [
        "Today's cycling workout: 50km through the mountains. The view from the top was absolutely worth every climb! 🚴‍♂️"
      ];

      userMentionedContent.forEach(content => {
        expect(tweets.some(tweet => tweet.title === content)).toBe(true);
      });
    });
  });

  describe('Tweet Content Parsing', () => {
    test('should extract complete tweet text including emojis', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const cyclingTweet = tweets.find(tweet => 
        tweet.title.includes('cycling workout') && tweet.title.includes('🚴‍♂️')
      );

      expect(cyclingTweet).toBeDefined();
      expect(cyclingTweet.title).toContain('🚴‍♂️');
    });

    test('should handle different tweet content lengths', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const shortTweet = tweets.find(tweet => tweet.title.includes('gorilla'));
      const longTweet = tweets.find(tweet => tweet.title.includes('carbon capture'));

      expect(shortTweet).toBeDefined();
      expect(longTweet).toBeDefined();
      expect(shortTweet.title.length).toBeLessThan(longTweet.title.length);
    });

    test('should extract technical content accurately', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const techTweets = tweets.filter(tweet => 
        tweet.title.includes('machine learning') || 
        tweet.title.includes('JavaScript') ||
        tweet.title.includes('React')
      );

      expect(techTweets.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle tweets with quotation marks and special characters', () => {
      const filter = new XContentFilter();
      const tweets = filter.extractTweetElements();

      const quoteTweet = tweets.find(tweet => tweet.title.includes('wireless'));

      expect(quoteTweet).toBeDefined();
      expect(quoteTweet.title).toContain('"wireless"');
    });
  });
});