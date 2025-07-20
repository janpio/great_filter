console.log('🔍 Great Filter: Reddit content script loaded');

class RedditContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractRedditPosts() {
    console.log('🔍 DEBUG: Starting extractRedditPosts()');
    const postElements = [];

    const postContainers = document.querySelectorAll('shreddit-post');
    console.log(`🔍 DEBUG: Found ${postContainers.length} Reddit posts`);

    postContainers.forEach((container, index) => {
      console.log(`🔍 DEBUG: Processing post ${index + 1}`);

      const title = container.getAttribute('post-title');

      if (title && !this.processedItems.has(title)) {
        console.log(`🔍 DEBUG: Adding new post: "${title}"`);
        postElements.push({
          title: title,
          container: container
        });
      } else if (title && this.processedItems.has(title)) {
        console.log(`🔍 DEBUG: Skipping already processed post: "${title}"`);
      } else {
        console.log('🔍 DEBUG: No title found for post container');
      }
    });

    console.log(`🔍 DEBUG: Total Reddit posts found: ${postElements.length}`);
    return postElements;
  }

  async processRedditPostsForFiltering(topics) {
    const postElements = this.extractRedditPosts();
    await this.processElementsBatch(postElements, topics, 'post');
  }

  init() {
    console.log('🔍 DEBUG: Initial Reddit post element check...');
    this.extractRedditPosts();

    this.setupMessageListener(
      (topics) => this.processRedditPostsForFiltering(topics),
      (topics) => this.startScrollMonitoring(topics, () => this.extractRedditPosts(), 'post')
    );

    console.log('🔍 Great Filter: Ready for Reddit filtering with scroll support. Use the popup to start!');
  }
}

const redditFilter = new RedditContentFilter();
redditFilter.init();
