
const runtimeSendMessage = (...args) => GFBrowser.runtimeSendMessage(...args);

class HackerNewsContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractItemElements() {
    const itemElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'tr.athing.submission',
      'tr.athing',
      'table tr.athing'
    ];


    containerSelectors.forEach((selector, index) => {
      const containers = document.querySelectorAll(selector);

      containers.forEach((container, containerIndex) => {
        if (processedContainers.has(container)) {
          return;
        }
        processedContainers.add(container);

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
            }
          }
        });

        if (titleElement) {
          let title = titleElement.textContent?.trim() || titleElement.innerText?.trim();

          if (title && title.length > 5) {
            const relatedElements = this.getStoryElements(container);

            itemElements.push({
              title: title,
              container: container,
              itemElements: relatedElements,
              titleElement: titleElement,
              usedSelector: usedSelector
            });
          }
        }
      });
    });

    return itemElements;
  }

  getStoryElements(titleRow) {
    const elements = [titleRow];

    let nextSibling = titleRow.nextElementSibling;
    while (nextSibling) {
      if (nextSibling.classList.contains('athing') && nextSibling.classList.contains('submission')) {
        break;
      }

      elements.push(nextSibling);
      nextSibling = nextSibling.nextElementSibling;

      if (nextSibling && nextSibling.classList.contains('spacer')) {
        elements.push(nextSibling);
        break;
      }
    }

    return elements;
  }

  blurWaitingElement(element) {
    if (element.itemElements) {
      element.itemElements.forEach(el => {
        if (!el.classList.contains('gf-waiting')) {
          el.classList.remove('gf-blocked', 'gf-allowed');
          el.classList.add('gf-waiting');
        }
      });
    } else {
      super.blurWaitingElement(element.container, element.title);
    }
  }

  blurBlockedElement(element) {
    if (element.itemElements) {
      element.itemElements.forEach(el => {
        el.classList.remove('gf-waiting', 'gf-allowed');
        el.classList.add('gf-blocked');
      });
    } else {
      super.blurBlockedElement(element.container, element.title);
    }
  }

  unblurElement(element) {
    if (element.itemElements) {
      element.itemElements.forEach(el => {
        el.classList.remove('gf-waiting', 'gf-blocked');
        el.classList.add('gf-allowed');
      });
    } else {
      super.unblurElement(element.container);
    }
  }

  async processElements(elements, topics = null) {
    try {
      if (elements.length === 0) {
        return;
      }

      const topicsToUse = topics || this.currentTopics;
      if (!topicsToUse) {
        console.error('❌ Great Filter: No topics available for filtering');
        return;
      }

      console.log(`Great Filter (Hacker News): Processing ${elements.length} items.`);

      elements.forEach(element => {
        this.processedItems.add(element.title);
        this.blurWaitingElement(element);
      });

      runtimeSendMessage({ action: 'contentProcessing' }).catch(() => {});

      const batches = [];
      for (let i = 0; i < elements.length; i += CONFIG.MAX_ITEMS_PER_BATCH) {
        batches.push(elements.slice(i, i + CONFIG.MAX_ITEMS_PER_BATCH));
      }

      const batchPromises = batches.map(async (batch, batchIndex) => {
        try {
          const response = await runtimeSendMessage({
            action: 'checkItemTitlesBatch',
            items: batch.map((element, index) => ({
              index: index + 1,
              title: element.title
            })),
            topics: topicsToUse
          });

          if (response.error) {
            if (response.error === 'DAILY_LIMIT_EXCEEDED') {
              console.warn('🚫 Great Filter: Daily limit exceeded:', response.message);
              this.showDailyLimitMessage(response);
              this.isFilteringActive = false;
              runtimeSendMessage({ action: 'filteringStopped' }).catch(() => {});
              return { error: response.error };
            }
            console.error('❌ Great Filter: Error checking items in batch:', response.error);
            return { error: response.error };
          }

          response.results.forEach((result, index) => {
            const element = batch[index];
            if (result.isAllowed) {
              this.unblurElement(element);
            } else {
              this.blurBlockedElement(element);
              this.blockedItems.add(element.title);
            }
          });

          return { success: true };
        } catch (error) {
          console.error(`❌ Great Filter: Error processing batch ${batchIndex}:`, error);
          return { error: error.message };
        }
      });

      await Promise.all(batchPromises);

      runtimeSendMessage({ action: 'filteringComplete' }).catch(() => {});

    } catch (error) {
      console.error('❌ Great Filter: Error in processElements:', error);
      runtimeSendMessage({ action: 'filteringComplete' }).catch(() => {});
    }
  }

  init() {
    this.setupMessageListener();

    this.waitForElements(
      () => this.extractItemElements(),
      () => {
        this.checkFilteringState();
      }
    );
  }
}

const hackerNewsFilter = new HackerNewsContentFilter();
hackerNewsFilter.init();
