console.log('🔍 Great Filter: Hacker News content script loaded');

class HackerNewsContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractStoryElements() {
    console.log('🔍 DEBUG: Starting extractStoryElements()');
    const storyElements = [];

    const containerSelectors = [
      'tr.athing.submission',
      'tr.athing',
      'table tr.athing'
    ];

    console.log('🔍 DEBUG: Container selectors:', containerSelectors);

    containerSelectors.forEach((selector, index) => {
      console.log(`🔍 DEBUG: Checking selector ${index + 1}: ${selector}`);
      const containers = document.querySelectorAll(selector);
      console.log(`🔍 DEBUG: Found ${containers.length} containers for selector: ${selector}`);

      containers.forEach((container, containerIndex) => {
        console.log(`🔍 DEBUG: Processing container ${containerIndex + 1} for selector: ${selector}`);

        const titleSelectors = [
          '.titleline a',
          '.title a',
          '.storylink',
          'td.title a',
          '.athing .title a'
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

          if (title && title.length > 5) {
            console.log(`🔍 DEBUG: Extracted title: "${title}" (selector: ${usedSelector})`);

            if (!this.processedItems.has(title)) {
              console.log(`🔍 DEBUG: Adding new story: "${title}"`);
              storyElements.push({
                title: title,
                container: container,
                titleElement: titleElement,
                usedSelector: usedSelector
              });
            } else {
              console.log(`🔍 DEBUG: Skipping already processed story: "${title}"`);
            }
          } else {
            console.log(`🔍 DEBUG: Title too short or empty: "${title}"`);
          }
        } else {
          console.log('🔍 DEBUG: No title element found in container');
        }
      });
    });

    console.log(`🔍 DEBUG: Total story elements found: ${storyElements.length}`);
    return storyElements;
  }

  async processStoriesForFiltering(topics) {
    const storyElements = this.extractStoryElements();

    if (storyElements.length > 0) {
      chrome.runtime.sendMessage({
        action: 'contentProcessing'
      });

      await this.processElementsBatch(storyElements, topics, 'story');

      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });
    }
  }

  init() {
    console.log('🔍 DEBUG: Initial story element check...');
    this.extractStoryElements();

    this.setupMessageListener(
      (topics) => this.processStoriesForFiltering(topics),
      (topics) => this.startScrollMonitoring(topics, () => this.extractStoryElements(), 'story')
    );

    setTimeout(() => {
      this.checkFilteringState(
        (topics) => this.processStoriesForFiltering(topics),
        (topics) => this.startScrollMonitoring(topics, () => this.extractStoryElements(), 'story')
      );
    }, 1000);

    console.log('🔍 Great Filter: Ready for Hacker News filtering with auto-start support!');
  }
}

const hackerNewsFilter = new HackerNewsContentFilter();
hackerNewsFilter.init();
