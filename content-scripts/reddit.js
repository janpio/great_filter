
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
                usedSelector: usedSelector,
                imageUrls: []
              });
            }
          }
        }
      });
    });

    return itemElements;
  }

  extractImageUrlsFromElements(elements) {
    elements.forEach(element => {
      const postType = element.container.getAttribute('post-type');

      if (postType === 'video') {
        const videoPlayer = element.container.querySelector('shreddit-player-2[poster]');
        if (videoPlayer) {
          const poster = videoPlayer.getAttribute('poster');
          if (poster) {
            element.imageUrls = [poster];
            return;
          }
        }
      } else if (postType === 'image') {
        const imgElement = element.container.querySelector('img.preview-img, img.i18n-post-media-img');
        if (imgElement) {
          const src = imgElement.getAttribute('src');
          if (src && (src.startsWith('https://preview.redd.it/') || src.startsWith('https://i.redd.it/'))) {
            element.imageUrls = [src];
            return;
          }
        }
      } else if (postType === 'gallery') {
        const galleryImages = element.container.querySelectorAll('gallery-carousel img.media-lightbox-img');
        const imageUrls = [];
        for (const img of galleryImages) {
          const src = img.getAttribute('src');
          if (src && (src.startsWith('https://preview.redd.it/') || src.startsWith('https://i.redd.it/'))) {
            imageUrls.push(src);
            if (imageUrls.length >= 3) break;
          }
        }
        if (imageUrls.length > 0) {
          element.imageUrls = imageUrls;
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

      await new Promise(resolve => setTimeout(resolve, CONFIG.MEDIA_LOAD_DELAY_MS));

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

const redditFilter = new RedditContentFilter();
redditFilter.init();