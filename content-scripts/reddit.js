console.log('🔍 Great Filter: Reddit content script loaded');

class RedditContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractItemElements() {
    console.log('🔍 DEBUG: Starting extractItemElements()');
    const itemElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'shreddit-post'
    ];

    console.log('🔍 DEBUG: Container selectors:', containerSelectors);

    containerSelectors.forEach((selector, index) => {
      console.log(`🔍 DEBUG: Checking selector ${index + 1}: ${selector}`);
      const containers = document.querySelectorAll(selector);
      console.log(`🔍 DEBUG: Found ${containers.length} containers for selector: ${selector}`);

      containers.forEach((container, containerIndex) => {
        if (processedContainers.has(container)) {
          console.log(`🔍 DEBUG: Skipping already processed container for selector: ${selector}`);
          return;
        }
        processedContainers.add(container);

        console.log(`🔍 DEBUG: Processing container ${containerIndex + 1} for selector: ${selector}`);

        const titleSelectors = [
          'a[slot="title"]',
          '.font-semibold.text-16-scalable',
          'a[id^="post-title-"]'
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
              console.log(`🔍 DEBUG: Adding new post: "${title}"`);

              itemElements.push({
                title: title,
                container: container,
                titleElement: titleElement,
                usedSelector: usedSelector
              });
            } else {
              console.log(`🔍 DEBUG: Skipping already processed post: "${title}"`);
            }
          } else {
            console.log(`🔍 DEBUG: Title too short or empty: "${title}"`);
          }
        } else {
          console.log('🔍 DEBUG: No title element found in container');
        }
      });
    });

    console.log(`🔍 DEBUG: Total post elements found: ${itemElements.length}`);
    return itemElements;
  }

  async processItemsForFiltering(topics) {
    const itemElements = this.extractItemElements();

    if (itemElements.length > 0) {
      chrome.runtime.sendMessage({
        action: 'contentProcessing'
      });

      await this.processElementsBatch(itemElements, topics, 'post');

      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });
    }
  }

  init() {
    console.log('🔍 DEBUG: Initial post element check...');
    this.extractItemElements();

    this.setupMessageListener(
      (topics) => this.processItemsForFiltering(topics),
      (topics) => this.startScrollMonitoring(topics, () => this.extractItemElements(), 'post')
    );

    this.waitForElements(
      () => this.extractItemElements(),
      () => {
        this.checkFilteringState(
          (topics) => this.processItemsForFiltering(topics),
          (topics) => this.startScrollMonitoring(topics, () => this.extractItemElements(), 'post')
        );
      }
    );

    console.log('🔍 Great Filter: Ready for Reddit filtering with auto-start support!');
  }
}

const redditFilter = new RedditContentFilter();
redditFilter.init();