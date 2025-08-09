
class XContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractItemElements() {
    const itemElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'article[data-testid="tweet"]',
      'div[data-testid="cellInnerDiv"] article',
      'article[role="article"]'
    ];


    containerSelectors.forEach((selector, index) => {
      const containers = document.querySelectorAll(selector);

      containers.forEach((container, containerIndex) => {
        if (processedContainers.has(container)) {
          return;
        }
        processedContainers.add(container);

        const titleSelectors = [
          '[data-testid="tweetText"]',
          'div[data-testid="tweetText"]',
          '[data-testid="card.wrapper"] [role="link"]',
          '[data-testid="card.wrapper"] span',
          'span[dir="ltr"]',
          '.css-146c3p1 span',
          'div[dir="auto"] span'
        ];

        let titleElement = null;
        let usedSelector = null;
        let title = null;

        titleSelectors.forEach(titleSelector => {
          if (!titleElement) {
            const elements = container.querySelectorAll(titleSelector);
            if (elements.length > 0) {
              elements.forEach(el => {
                const text = el.textContent?.trim();
                if (text && text.length > 10 && !text.includes('·') && !text.includes('@') && !text.includes('replies') && !text.includes('reposts')) {
                  titleElement = el;
                  title = text;
                  usedSelector = titleSelector;
                  return;
                }
              });
            }
          }
        });

        if (titleElement && title) {

          if (!this.processedItems.has(title)) {
            itemElements.push({
              title: title,
              container: container,
              titleElement: titleElement,
              usedSelector: usedSelector
            });
          }
        }
      });
    });

    return itemElements;
  }


  async processElementsBatch(elements, topics, elementType = 'tweet') {

    try {
      if (elements.length === 0) {
        return;
      }

      elements.forEach(element => {
        this.processedItems.add(element.title);
        this.blurWaitingElement(element.container, element.title);
      });


      const response = await chrome.runtime.sendMessage({
        action: 'checkItemTitlesBatch',
        items: elements.map((element, index) => ({
          index: index + 1,
          title: element.title,
          container: element.container
        })),
        topics: topics
      });


      if (response.error) {
        console.error(`❌ Great Filter: Error checking ${elementType}s:`, response.error);
        return;
      }

      response.results.forEach((result, index) => {
        const element = elements[index];
        if (result.isAllowed) {
          this.unblurElement(element.container);
        } else {
          this.blurBlockedElement(element.container, element.title);
        }
      });
    } catch (error) {
      console.error(`❌ Great Filter: Error in processElementsBatch for ${elementType}s:`, error);
    }
  }

  async processItemsForFiltering(topics) {
    const itemElements = this.extractItemElements();

    if (itemElements.length > 0) {
      chrome.runtime.sendMessage({
        action: 'contentProcessing'
      });

      await this.processElementsBatch(itemElements, topics, 'tweet');

      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });
    }
  }

  init() {
    const initialTweets = this.extractItemElements();

    this.setupMessageListener(
      (topics) => {
        return this.processItemsForFiltering(topics);
      },
      (topics) => {
        return this.startScrollMonitoring(topics, () => this.extractItemElements(), 'tweet');
      }
    );

    this.waitForElements(
      () => this.extractItemElements(),
      () => {
        this.checkFilteringState(
          (topics) => {
            return this.processItemsForFiltering(topics);
          },
          (topics) => {
            return this.startScrollMonitoring(topics, () => this.extractItemElements(), 'tweet');
          }
        );
      }
    );

  }
}

const xFilter = new XContentFilter();
xFilter.init();