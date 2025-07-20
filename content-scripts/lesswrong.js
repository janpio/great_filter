console.log('🔍 Great Filter: LessWrong content script loaded');

class LessWrongContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractLessWrongContent() {
    console.log('🔍 DEBUG: Starting extractLessWrongContent()');
    const contentElements = [];

    const postSelectors = [
      '.LWPostsItem-root',
      '.PostsItem-root',
      'span[class*="post_"]'
    ];

    postSelectors.forEach(selector => {
      const posts = document.querySelectorAll(selector);
      console.log(`🔍 DEBUG: Found ${posts.length} posts with selector: ${selector}`);

      posts.forEach((container, index) => {
        const titleSelectors = [
          '.PostsTitle-root a span',
          '.LWPostsItem-title a span',
          '.PostsItem-title a',
          'a[href*="/posts/"] span'
        ];

        let titleElement = null;
        let title = null;

        titleSelectors.forEach(titleSelector => {
          if (!titleElement) {
            titleElement = container.querySelector(titleSelector);
            if (titleElement) {
              title = titleElement.textContent?.trim() || titleElement.innerText?.trim();
              console.log(`🔍 DEBUG: Found post title: "${title}" with selector: ${titleSelector}`);
            }
          }
        });

        if (title && title.length > 5 && !this.processedItems.has(title)) {
          console.log(`🔍 DEBUG: Adding new post: "${title}"`);
          contentElements.push({
            title: title,
            container: container,
            type: 'post'
          });
        }
      });
    });

    const quickTakes = document.querySelectorAll('.LWQuickTakesCollapsedListItem-root');
    console.log(`🔍 DEBUG: Found ${quickTakes.length} quick takes`);

    quickTakes.forEach((container, index) => {
      const textElement = container.querySelector('.LWQuickTakesCollapsedListItem-body');

      if (textElement) {
        let text = textElement.textContent?.trim() || textElement.innerText?.trim();

        if (text && text.length > 20) {
          text = text.substring(0, 150);

          if (!this.processedItems.has(text)) {
            console.log(`🔍 DEBUG: Adding new quick take: "${text}..."`);
            contentElements.push({
              title: text,
              container: container,
              type: 'quick_take'
            });
          }
        }
      }
    });

    console.log(`🔍 DEBUG: Total LessWrong content found: ${contentElements.length}`);
    return contentElements;
  }

  async processLessWrongContentForFiltering(topics) {
    const contentElements = this.extractLessWrongContent();
    await this.processElementsBatch(contentElements, topics, 'content');
  }

  init() {
    console.log('🔍 DEBUG: Initial LessWrong content element check...');
    this.extractLessWrongContent();

    this.setupMessageListener(
      (topics) => this.processLessWrongContentForFiltering(topics),
      (topics) => this.startScrollMonitoring(topics, () => this.extractLessWrongContent(), 'content')
    );

    setTimeout(() => {
      this.autoStartFiltering(
        (topics) => this.processLessWrongContentForFiltering(topics),
        (topics) => this.startScrollMonitoring(topics, () => this.extractLessWrongContent(), 'content')
      );
    }, 1000);

    console.log('🔍 Great Filter: Ready for LessWrong filtering with auto-start support!');
  }
}

const lessWrongFilter = new LessWrongContentFilter();
lessWrongFilter.init();
