
class RedditContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractItemElements() {
    const itemElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'shreddit-post'
    ];


    containerSelectors.forEach((selector, index) => {
      const containers = document.querySelectorAll(selector);

      containers.forEach((container, containerIndex) => {
        if (processedContainers.has(container)) {
          return;
        }
        processedContainers.add(container);

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
            }
          }
        });

        if (titleElement) {
          let title = titleElement.textContent?.trim() || titleElement.innerText?.trim();

          if (title && title.length > 5) {

            if (!this.processedItems.has(title)) {
              itemElements.push({
                title: title,
                container: container,
                titleElement: titleElement,
                usedSelector: usedSelector
              });
            }
          }
        }
      });
    });

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

  }
}

const redditFilter = new RedditContentFilter();
redditFilter.init();