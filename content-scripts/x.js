
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

  blurWaitingElement(containerOrElement, title) {
    if (typeof containerOrElement === 'object' && containerOrElement.container) {
      const element = containerOrElement;
      if (!element.container.style.filter) {
        element.container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
        element.container.style.opacity = VISUAL_EFFECTS.WAITING_OPACITY;
        element.container.style.pointerEvents = 'none';
      }
    } else if (containerOrElement && containerOrElement.style) {
      const container = containerOrElement;
      if (!container.style.filter) {
        container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
        container.style.opacity = VISUAL_EFFECTS.WAITING_OPACITY;
        container.style.pointerEvents = 'none';
      }
    } else {
    }
  }

  blurBlockedElement(containerOrElement, title) {
    if (typeof containerOrElement === 'object' && containerOrElement.container) {
      const element = containerOrElement;
      element.container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
      element.container.style.opacity = VISUAL_EFFECTS.BLOCKED_OPACITY;
      element.container.style.pointerEvents = 'none';
    } else if (containerOrElement && containerOrElement.style) {
      const container = containerOrElement;
      container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
      container.style.opacity = VISUAL_EFFECTS.BLOCKED_OPACITY;
      container.style.pointerEvents = 'none';
    } else {
    }
  }

  unblurElement(containerOrElement) {
    if (typeof containerOrElement === 'object' && containerOrElement.container) {
      const element = containerOrElement;
      element.container.style.filter = '';
      element.container.style.opacity = VISUAL_EFFECTS.ALLOWED_OPACITY;
      element.container.style.pointerEvents = '';
    } else if (containerOrElement && containerOrElement.style) {
      const container = containerOrElement;
      container.style.filter = '';
      container.style.opacity = VISUAL_EFFECTS.ALLOWED_OPACITY;
      container.style.pointerEvents = '';
    } else {
    }
  }

  async processElementsBatch(elements, topics, elementType = 'tweet') {

    try {
      if (elements.length === 0) {
        return;
      }

      elements.forEach(element => {
        this.processedItems.add(element.title);
        this.blurWaitingElement(element);
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
          this.unblurElement(element);
        } else {
          this.blurBlockedElement(element);
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