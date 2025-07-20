console.log('🔍 Great Filter: X (Twitter) content script loaded');

class XContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractTweetElements() {
    console.log('🔍 DEBUG: Starting extractTweetElements()');
    const tweetElements = [];

    const containerSelectors = [
      'article[data-testid="tweet"]',
      '[data-testid="tweet"]',
      '[data-testid="cellInnerDiv"] article',
      'article[role="article"]',
      '.css-175oi2r.r-18u37iz.r-1q142lx'
    ];

    console.log('🔍 DEBUG: Container selectors:', containerSelectors);

    containerSelectors.forEach((selector, index) => {
      console.log(`🔍 DEBUG: Checking selector ${index + 1}: ${selector}`);
      const containers = document.querySelectorAll(selector);
      console.log(`🔍 DEBUG: Found ${containers.length} containers for selector: ${selector}`);

      containers.forEach((container, containerIndex) => {
        console.log(`🔍 DEBUG: Processing container ${containerIndex + 1} for selector: ${selector}`);

        const titleSelectors = [
          '[data-testid="tweetText"]',
          '[data-testid="tweetText"] span',
          '[data-testid="tweetText"] div',
          '.css-1jxf684',
          '.css-901oao.r-18jsvk2.r-37j5jr.r-a023e6.r-16dba41.r-rjixqe.r-bcqeeo.r-bnwqim.r-qvutc0',
          'div[lang] span',
          'div[data-testid="tweetText"] span',
          'span[data-testid="tweetText"]'
        ];

        let titleElement = null;
        let usedSelector = null;

        titleSelectors.forEach(titleSelector => {
          if (!titleElement) {
            titleElement = container.querySelector(titleSelector);
            if (titleElement) {
              usedSelector = titleSelector;
              console.log(`🔍 DEBUG: Found title element with selector: ${titleSelector}`);
            }
          }
        });

        if (titleElement) {
          let title = titleElement.textContent?.trim() || titleElement.innerText?.trim();

          if (title && title.length > 10) {
            console.log(`🔍 DEBUG: Extracted title: "${title}" (selector: ${usedSelector})`);

            if (!this.processedItems.has(title)) {
              console.log(`🔍 DEBUG: Adding new tweet: "${title}"`);
              tweetElements.push({
                title: title,
                container: container,
                titleElement: titleElement,
                usedSelector: usedSelector
              });
            } else {
              console.log(`🔍 DEBUG: Skipping already processed tweet: "${title}"`);
            }
          } else {
            console.log(`🔍 DEBUG: Title too short or empty: "${title}"`);
          }
        } else {
          console.log('🔍 DEBUG: No title element found in container');
        }
      });
    });

    console.log(`🔍 DEBUG: Total tweet elements found: ${tweetElements.length}`);
    return tweetElements;
  }

  async processTweetsForFiltering(topics) {
    const tweetElements = this.extractTweetElements();
    await this.processElementsBatch(tweetElements, topics, 'tweet');
  }

  init() {
    console.log('🔍 DEBUG: Initial tweet element check...');
    this.extractTweetElements();

    this.setupMessageListener(
      (topics) => this.processTweetsForFiltering(topics),
      (topics) => this.startScrollMonitoring(topics, () => this.extractTweetElements(), 'tweet')
    );

    setTimeout(() => {
      this.autoStartFiltering(
        (topics) => this.processTweetsForFiltering(topics),
        (topics) => this.startScrollMonitoring(topics, () => this.extractTweetElements(), 'tweet')
      );
    }, 1000);

    console.log('🔍 Great Filter: Ready for X (Twitter) filtering with auto-start support!');
  }
}

const xFilter = new XContentFilter();
xFilter.init();
