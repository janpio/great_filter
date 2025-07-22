console.log('🔍 Great Filter: YouTube content script loaded');

class YouTubeContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractVideoElements() {
    console.log('🔍 DEBUG: Starting extractVideoElements()');
    const videoElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'ytd-rich-grid-media',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-rich-item-renderer',
      'ytd-grid-video-renderer',
      'ytd-playlist-video-renderer',
      'ytd-movie-renderer',
      'yt-lockup-view-model'
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
          'yt-formatted-string#video-title',
          'a#video-title-link',
          'h3 a',
          'span[title]',
          'a[title]',
          'yt-lockup-view-model a[aria-label]',
          'yt-lockup-view-model img[alt]'
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
          let title = titleElement.textContent?.trim() ||
                     titleElement.title?.trim() ||
                     titleElement.getAttribute('title')?.trim() ||
                     titleElement.getAttribute('aria-label')?.trim() ||
                     titleElement.getAttribute('alt')?.trim();

          console.log(`🔍 DEBUG: Extracted title: "${title}" (selector: ${usedSelector})`);

          if (title && !this.processedItems.has(title)) {
            console.log(`🔍 DEBUG: Adding new video: "${title}"`);
            videoElements.push({
              title: title,
              container: container,
              titleElement: titleElement,
              usedSelector: usedSelector
            });
          } else if (title && this.processedItems.has(title)) {
            console.log(`🔍 DEBUG: Skipping already processed video: "${title}"`);
          } else {
            console.log('🔍 DEBUG: No title found for container');
          }
        } else {
          console.log('🔍 DEBUG: No title element found in container');
        }
      });
    });

    console.log(`🔍 DEBUG: Total video elements found: ${videoElements.length}`);
    return videoElements;
  }

  async processVideosForFiltering(topics) {
    const videoElements = this.extractVideoElements();

    if (videoElements.length > 0) {
      chrome.runtime.sendMessage({
        action: 'contentProcessing'
      });

      await this.processElementsBatch(videoElements, topics, 'video');

      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });
    }
  }

  init() {
    console.log('🔍 DEBUG: Initial video element check...');
    this.extractVideoElements();

    this.setupMessageListener(
      (topics) => this.processVideosForFiltering(topics),
      (topics) => this.startScrollMonitoring(topics, () => this.extractVideoElements(), 'video')
    );

    setTimeout(() => {
      this.checkFilteringState(
        (topics) => this.processVideosForFiltering(topics),
        (topics) => this.startScrollMonitoring(topics, () => this.extractVideoElements(), 'video')
      );
    }, 1000);

    console.log('🔍 Great Filter: Ready for YouTube filtering with auto-start support!');
  }
}

const youtubeFilter = new YouTubeContentFilter();
youtubeFilter.init();
