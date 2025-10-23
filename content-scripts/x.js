
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

    containerSelectors.forEach(selector => {
      const containers = document.querySelectorAll(selector);

      containers.forEach(container => {
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
              usedSelector: usedSelector,
              imageUrls: []
            });
          }
        }
      });
    });

    return itemElements;
  }

  extractImageUrlsFromElements(elements) {
    elements.forEach(element => {
      const imageElements = element.container.querySelectorAll('[data-testid="tweetPhoto"] img');
      for (const img of imageElements) {
        const src = img.getAttribute('src');
        if (src && src.startsWith('https://pbs.twimg.com/media/')) {
          element.imageUrls = [src];
          return;
        }
      }

      const videoElements = element.container.querySelectorAll('[data-testid="videoPlayer"] video');
      for (const video of videoElements) {
        const poster = video.getAttribute('poster');
        if (poster && poster.startsWith('https://pbs.twimg.com/')) {
          element.imageUrls = [poster];
          return;
        }
      }

      element.imageUrls = [];
    });
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

      elements.forEach(element => {
        this.processedItems.add(element.title);
        this.blurWaitingElement(element.container, element.title);
      });

      chrome.runtime.sendMessage({ action: 'contentProcessing' });

      await new Promise(resolve => setTimeout(resolve, CONFIG.X_MEDIA_LOAD_DELAY_MS));

      this.extractImageUrlsFromElements(elements);

      const response = await chrome.runtime.sendMessage({
        action: 'checkItemTitlesBatch',
        items: elements.map((element, index) => ({
          index: index + 1,
          title: element.title,
          container: element.container,
          imageUrls: element.imageUrls || []
        })),
        topics: topicsToUse
      });

      if (response.error) {
        if (response.error === 'DAILY_LIMIT_EXCEEDED') {
          console.warn('🚫 Great Filter: Daily limit exceeded:', response.message);
          this.showDailyLimitMessage(response);
          this.isFilteringActive = false;
          chrome.runtime.sendMessage({ action: 'filteringStopped' });
          chrome.runtime.sendMessage({ action: 'filteringComplete' });
          return;
        }
        console.error('❌ Great Filter: Error checking items:', response.error);
        chrome.runtime.sendMessage({ action: 'filteringComplete' });
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

      chrome.runtime.sendMessage({ action: 'filteringComplete' });

    } catch (error) {
      console.error('❌ Great Filter: Error in processElements:', error);
      chrome.runtime.sendMessage({ action: 'filteringComplete' });
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

const xFilter = new XContentFilter();
xFilter.init();