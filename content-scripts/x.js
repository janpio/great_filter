
const runtimeSendMessage = (...args) => GFBrowser.runtimeSendMessage(...args);

class XContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractMediaDescriptions(container) {
    const mediaParts = [];

    const videoElement = container.querySelector('[data-testid="videoPlayer"] video[aria-label]');
    if (videoElement) {
      const videoLabel = videoElement.getAttribute('aria-label')?.trim();
      if (videoLabel) {
        mediaParts.push(`Video: ${videoLabel}`);
      }
    }

    const imageElement = container.querySelector('[data-testid="tweetPhoto"][aria-label]');
    if (imageElement) {
      const imageLabel = imageElement.getAttribute('aria-label')?.trim();
      if (imageLabel) {
        mediaParts.push(`Image: ${imageLabel}`);
      }
    }

    return mediaParts;
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

        const titleElement = container.querySelector('[data-testid="tweetText"]');
        let text = null;

        if (titleElement) {
          text = titleElement.textContent?.trim();
        }

        const mediaParts = this.extractMediaDescriptions(container);

        let title = null;
        if (text) {
          title = text;
          if (mediaParts.length > 0) {
            title += '\nMedia: ' + mediaParts.join(', ');
          }
        } else if (mediaParts.length > 0) {
          title = 'Media: ' + mediaParts.join(', ');
        }

        if (title) {
          itemElements.push({
            title: title,
            container: container,
            titleElement: titleElement || container,
            imageUrls: []
          });
        }
      });
    });

    console.log(`🔍 Great Filter: Extracted ${itemElements.length} new items. Total processed: ${this.processedItems.size}`);
    console.log('📋 Processed items:', Array.from(this.processedItems));

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

      runtimeSendMessage({ action: 'contentProcessing' }).catch(() => {});

      await new Promise(resolve => setTimeout(resolve, CONFIG.MEDIA_LOAD_DELAY_MS));

      this.extractImageUrlsFromElements(elements);

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
              title: element.title,
              imageUrls: element.imageUrls || []
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
              this.unblurElement(element.container);
            } else {
              this.blurBlockedElement(element.container, element.title);
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

const xFilter = new XContentFilter();
xFilter.init();
