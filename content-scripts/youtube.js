
class YouTubeContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractItemElements() {
    const itemElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'ytd-rich-grid-media',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-rich-item-renderer',
      'ytd-grid-video-renderer',
      'ytd-playlist-video-renderer',
      'ytd-movie-renderer',
      'yt-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2',
      'ytm-shorts-lockup-view-model'
    ];


    containerSelectors.forEach((selector, index) => {
      const containers = document.querySelectorAll(selector);

      containers.forEach((container, containerIndex) => {
        if (processedContainers.has(container)) {
          return;
        }
        processedContainers.add(container);

        const titleSelectors = [
          'yt-formatted-string#video-title',
          'a#video-title-link',
          'h3 a',
          'span[title]',
          'a[title]',
          'yt-lockup-view-model a[aria-label]',
          'yt-lockup-view-model img[alt]',
          '.shortsLockupViewModelHostMetadataTitle a',
          '.shortsLockupViewModelHostMetadataTitle span',
          '.shortsLockupViewModelHostOutsideMetadataTitle a',
          '.shortsLockupViewModelHostOutsideMetadataTitle span'
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
          let title = titleElement.textContent?.trim() ||
                     titleElement.title?.trim() ||
                     titleElement.getAttribute('title')?.trim() ||
                     titleElement.getAttribute('aria-label')?.trim() ||
                     titleElement.getAttribute('alt')?.trim();


          if (title) {
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

  // Emit a domain-specific log before delegating to the shared processor for easier debugging.
  async processElements(elements, topics = null) {
    if (elements.length > 0) {
      console.log(`Great Filter (YouTube): Processing ${elements.length} items.`);
    }
    await super.processElements(elements, topics);
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

const youtubeFilter = new YouTubeContentFilter();
youtubeFilter.init();
