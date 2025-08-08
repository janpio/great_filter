console.log('🔍 Great Filter: X content script loaded');

class XContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractItemElements() {
    console.log('🔍 DEBUG: Starting extractItemElements()');
    const itemElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'article[data-testid="tweet"]',
      'div[data-testid="cellInnerDiv"] article',
      'article[role="article"]'
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
                  console.log(`🔍 DEBUG: Found title element with selector: ${titleSelector}`);
                  return;
                }
              });
            }
          }
        });

        if (titleElement && title) {
          console.log(`🔍 DEBUG: Extracted title: "${title}" (selector: ${usedSelector})`);

          if (!this.processedItems.has(title)) {
            console.log(`🔍 DEBUG: Adding new tweet: "${title}"`);

            itemElements.push({
              title: title,
              container: container,
              titleElement: titleElement,
              usedSelector: usedSelector
            });
          } else {
            console.log(`🔍 DEBUG: Skipping already processed tweet: "${title}"`);
          }
        } else {
          console.log('🔍 DEBUG: No title element found in container');
        }
      });
    });

    console.log(`🔍 DEBUG: Total tweet elements found: ${itemElements.length}`);
    return itemElements;
  }

  blurWaitingElement(containerOrElement, title) {
    if (typeof containerOrElement === 'object' && containerOrElement.container) {
      const element = containerOrElement;
      if (!element.container.style.filter) {
        element.container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
        element.container.style.opacity = VISUAL_EFFECTS.WAITING_OPACITY;
        element.container.style.pointerEvents = 'none';
        console.log('⏳ Great Filter: Applied heavy waiting blur to tweet:', element.title);
      }
    } else if (containerOrElement && containerOrElement.style) {
      const container = containerOrElement;
      if (!container.style.filter) {
        container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
        container.style.opacity = VISUAL_EFFECTS.WAITING_OPACITY;
        container.style.pointerEvents = 'none';
        console.log('⏳ Great Filter: Applied heavy waiting blur to tweet:', title);
      }
    } else {
      console.error('⚠️ DEBUG: Invalid parameters passed to blurWaitingElement:', containerOrElement, title);
    }
  }

  blurBlockedElement(containerOrElement, title) {
    if (typeof containerOrElement === 'object' && containerOrElement.container) {
      const element = containerOrElement;
      element.container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
      element.container.style.opacity = VISUAL_EFFECTS.BLOCKED_OPACITY;
      element.container.style.pointerEvents = 'none';
      console.log('🚫 Great Filter: Applied blocked blur to tweet:', element.title);
    } else if (containerOrElement && containerOrElement.style) {
      const container = containerOrElement;
      container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
      container.style.opacity = VISUAL_EFFECTS.BLOCKED_OPACITY;
      container.style.pointerEvents = 'none';
      console.log('🚫 Great Filter: Applied blocked blur to tweet:', title);
    } else {
      console.error('⚠️ DEBUG: Invalid parameters passed to blurBlockedElement:', containerOrElement, title);
    }
  }

  unblurElement(containerOrElement) {
    if (typeof containerOrElement === 'object' && containerOrElement.container) {
      const element = containerOrElement;
      element.container.style.filter = '';
      element.container.style.opacity = VISUAL_EFFECTS.ALLOWED_OPACITY;
      element.container.style.pointerEvents = '';
      console.log('✅ Great Filter: Removed blur from tweet:', element.title);
    } else if (containerOrElement && containerOrElement.style) {
      const container = containerOrElement;
      container.style.filter = '';
      container.style.opacity = VISUAL_EFFECTS.ALLOWED_OPACITY;
      container.style.pointerEvents = '';
      console.log('✅ Great Filter: Removed blur from tweet');
    } else {
      console.error('⚠️ DEBUG: Invalid parameter passed to unblurElement:', containerOrElement);
    }
  }

  async processElementsBatch(elements, topics, elementType = 'tweet') {
    console.log(`🚀 DEBUG: Starting processElementsBatch for ${elementType}s`);
    console.log('🚀 DEBUG: Topics provided:', topics);

    try {
      if (elements.length === 0) {
        console.log(`❌ Great Filter: No new ${elementType}s found`);
        return;
      }

      console.log(`🚀 Great Filter: Processing ${elements.length} ${elementType}s in single batch`);

      elements.forEach(element => {
        this.processedItems.add(element.title);
        this.blurWaitingElement(element);
      });

      console.log(`📡 DEBUG: Sending batch of ${elements.length} ${elementType}s to background script`);

      const response = await chrome.runtime.sendMessage({
        action: 'checkItemTitlesBatch',
        items: elements.map((element, index) => ({
          index: index + 1,
          title: element.title,
          container: element.container
        })),
        topics: topics
      });

      console.log('📡 DEBUG: Batch response received:', response);

      if (response.error) {
        console.error(`❌ Great Filter: Error checking ${elementType}s:`, response.error);
        return;
      }

      console.log(`🎯 DEBUG: Applying batch results to ${elementType}s`);
      response.results.forEach((result, index) => {
        const element = elements[index];
        if (result.isAllowed) {
          this.unblurElement(element);
          console.log(`✅ Great Filter: ${elementType} ${index + 1} allowed: "${element.title}"`);
        } else {
          this.blurBlockedElement(element);
          console.log(`🚫 Great Filter: ${elementType} ${index + 1} blocked: "${element.title}"`);
        }
      });

      console.log(`🎉 DEBUG: Finished processing all ${elementType}s in batch`);
    } catch (error) {
      console.error(`❌ Great Filter: Error in processElementsBatch for ${elementType}s:`, error);
    }
  }

  async processItemsForFiltering(topics) {
    const itemElements = this.extractItemElements();
    console.log(`🔄 DEBUG: processItemsForFiltering found ${itemElements.length} new tweets to process`);

    if (itemElements.length > 0) {
      console.log('📡 DEBUG: Sending contentProcessing message to background');
      chrome.runtime.sendMessage({
        action: 'contentProcessing'
      });

      await this.processElementsBatch(itemElements, topics, 'tweet');

      console.log('📡 DEBUG: Sending filteringComplete message to background');
      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });
    } else {
      console.log('⚠️ DEBUG: No new tweets to process - all already seen');
    }
  }

  init() {
    console.log('🔍 DEBUG: Initial tweet element check...');
    const initialTweets = this.extractItemElements();
    console.log(`🔍 DEBUG: Found ${initialTweets.length} tweets during initialization`);

    this.setupMessageListener(
      (topics) => {
        console.log('📨 DEBUG: Received startFiltering message with topics:', topics);
        return this.processItemsForFiltering(topics);
      },
      (topics) => {
        console.log('📨 DEBUG: Starting scroll monitoring with topics:', topics);
        return this.startScrollMonitoring(topics, () => this.extractItemElements(), 'tweet');
      }
    );

    this.waitForElements(
      () => this.extractItemElements(),
      () => {
        console.log('🔍 DEBUG: Elements found, checking filtering state...');
        this.checkFilteringState(
          (topics) => {
            console.log('🚀 DEBUG: Auto-starting filtering with topics:', topics);
            return this.processItemsForFiltering(topics);
          },
          (topics) => {
            console.log('🚀 DEBUG: Auto-starting scroll monitoring with topics:', topics);
            return this.startScrollMonitoring(topics, () => this.extractItemElements(), 'tweet');
          }
        );
      }
    );

    console.log('🔍 Great Filter: Ready for X filtering with auto-start support!');
  }
}

const xFilter = new XContentFilter();
xFilter.init();