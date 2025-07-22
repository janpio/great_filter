console.log('🔍 Great Filter: Hacker News content script loaded');

class HackerNewsContentFilter extends ContentFilterBase {
  constructor() {
    super();
  }

  extractStoryElements() {
    console.log('🔍 DEBUG: Starting extractStoryElements()');
    const storyElements = [];
    const processedContainers = new Set();

    const containerSelectors = [
      'tr.athing.submission',
      'tr.athing',
      'table tr.athing'
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
              console.log(`🔍 DEBUG: Found title element with selector: ${titleSelector}`);
            }
          }
        });

        if (titleElement) {
          let title = titleElement.textContent?.trim() || titleElement.innerText?.trim();

          if (title && title.length > 5) {
            console.log(`🔍 DEBUG: Extracted title: "${title}" (selector: ${usedSelector})`);

            if (!this.processedItems.has(title)) {
              console.log(`🔍 DEBUG: Adding new story: "${title}"`);

              const relatedElements = this.getStoryElements(container);

              storyElements.push({
                title: title,
                container: container,
                storyElements: relatedElements,
                titleElement: titleElement,
                usedSelector: usedSelector
              });
            } else {
              console.log(`🔍 DEBUG: Skipping already processed story: "${title}"`);
            }
          } else {
            console.log(`🔍 DEBUG: Title too short or empty: "${title}"`);
          }
        } else {
          console.log('🔍 DEBUG: No title element found in container');
        }
      });
    });

    console.log(`🔍 DEBUG: Total story elements found: ${storyElements.length}`);
    return storyElements;
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
    if (element.storyElements) {
      element.storyElements.forEach(el => {
        if (!el.style.filter) {
          el.style.filter = 'blur(6px) grayscale(100%) brightness(0.2)';
          el.style.opacity = '0.8';
          el.style.pointerEvents = 'none';
        }
      });
      console.log('⏳ Great Filter: Applied heavy waiting blur to story elements:', element.title);
    } else {
      super.blurWaitingElement(element.container, element.title);
    }
  }

  blurBlockedElement(element) {
    if (element.storyElements) {
      element.storyElements.forEach(el => {
        el.style.filter = 'blur(6px) grayscale(100%) brightness(0.2)';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      });
      console.log('🚫 Great Filter: Applied blocked blur to story elements:', element.title);
    } else {
      super.blurBlockedElement(element.container, element.title);
    }
  }

  unblurElement(element) {
    if (element.storyElements) {
      element.storyElements.forEach(el => {
        el.style.filter = '';
        el.style.opacity = '';
        el.style.pointerEvents = '';
      });
      console.log('✅ Great Filter: Removed blur from story elements:', element.title);
    } else {
      super.unblurElement(element.container);
    }
  }

  async processElementsBatch(elements, topics, elementType = 'story') {
    console.log(`🚀 DEBUG: Starting processElementsBatch for ${elementType}s`);
    console.log('🚀 DEBUG: Topics provided:', topics);

    try {
      if (elements.length === 0) {
        console.log(`❌ Great Filter: No new ${elementType}s found`);
        return;
      }

      console.log(`🚀 Great Filter: Processing ${elements.length} ${elementType}s in single batch`);

      this.statistics.totalPosts += elements.length;
      console.log('📊 DEBUG: Incremented totalPosts by', elements.length, 'new total:', this.statistics.totalPosts);

      elements.forEach(element => {
        this.processedItems.add(element.title);
        this.blurWaitingElement(element);
      });

      console.log(`📡 DEBUG: Sending batch of ${elements.length} ${elementType}s to background script`);

      const response = await chrome.runtime.sendMessage({
        action: 'checkVideoTitlesBatch',
        videos: elements.map((element, index) => ({
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
          this.statistics.shownPosts++;
          this.unblurElement(element);
          console.log(`✅ Great Filter: ${elementType} ${index + 1} allowed: "${element.title}"`);
        } else {
          this.statistics.filteredPosts++;
          this.blurBlockedElement(element);
          console.log(`🚫 Great Filter: ${elementType} ${index + 1} blocked: "${element.title}"`);
        }
      });

      this.sendStatsUpdate();

      console.log(`🎉 DEBUG: Finished processing all ${elementType}s in batch`);
    } catch (error) {
      console.error(`❌ Great Filter: Error in processElementsBatch for ${elementType}s:`, error);
    }
  }

  async handleScroll(extractElementsFunction, elementType = 'story') {
    if (!this.currentTopics || this.isScrollProcessing) return;

    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(async () => {
      console.log(`📜 DEBUG: Scroll detected, checking for new ${elementType}s`);

      const allElements = extractElementsFunction();
      const newElements = allElements.filter(element => !this.processedItems.has(element.title));

      if (newElements.length > 0) {
        console.log(`📜 DEBUG: Found ${newElements.length} new ${elementType}s on scroll`);
        this.isScrollProcessing = true;

        this.statistics.totalPosts += newElements.length;

        try {
          newElements.forEach(element => {
            this.blurWaitingElement(element);
          });

          console.log(`📡 DEBUG: Sending batch of ${newElements.length} new ${elementType}s to background script`);

          chrome.runtime.sendMessage({
            action: 'contentProcessing'
          });

          const response = await chrome.runtime.sendMessage({
            action: 'checkVideoTitlesBatch',
            videos: newElements.map((element, index) => ({
              index: index + 1,
              title: element.title,
              container: element.container
            })),
            topics: this.currentTopics
          });

          console.log('📡 DEBUG: Scroll batch response received:', response);

          if (response.error) {
            console.error(`❌ Great Filter: Error checking scroll ${elementType}s:`, response.error);
            chrome.runtime.sendMessage({
              action: 'filteringComplete'
            });
            return;
          }

          console.log(`🎯 DEBUG: Applying scroll batch results to ${elementType}s`);
          response.results.forEach((result, index) => {
            const element = newElements[index];

            if (result.isAllowed) {
              this.statistics.shownPosts++;
              this.unblurElement(element);
              console.log(`✅ Great Filter: Scroll ${elementType} ${index + 1} allowed: "${element.title}"`);
            } else {
              this.statistics.filteredPosts++;
              this.blurBlockedElement(element);
              console.log(`🚫 Great Filter: Scroll ${elementType} ${index + 1} blocked: "${element.title}"`);
            }
          });

          this.sendStatsUpdate();

          console.log(`🎉 DEBUG: Finished processing scroll ${elementType}s in batch`);

          chrome.runtime.sendMessage({
            action: 'filteringComplete'
          });
        } catch (error) {
          console.error(`❌ Great Filter: Error processing scroll ${elementType}s:`, error);
          chrome.runtime.sendMessage({
            action: 'filteringComplete'
          });
        } finally {
          this.isScrollProcessing = false;
        }
      }
    }, 1000);
  }

  async processStoriesForFiltering(topics) {
    const storyElements = this.extractStoryElements();

    if (storyElements.length > 0) {
      chrome.runtime.sendMessage({
        action: 'contentProcessing'
      });

      await this.processElementsBatch(storyElements, topics, 'story');

      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });
    }
  }

  init() {
    console.log('🔍 DEBUG: Initial story element check...');
    this.extractStoryElements();

    this.setupMessageListener(
      (topics) => this.processStoriesForFiltering(topics),
      (topics) => this.startScrollMonitoring(topics, () => this.extractStoryElements(), 'story')
    );

    setTimeout(() => {
      this.checkFilteringState(
        (topics) => this.processStoriesForFiltering(topics),
        (topics) => this.startScrollMonitoring(topics, () => this.extractStoryElements(), 'story')
      );
    }, 1000);

    console.log('🔍 Great Filter: Ready for Hacker News filtering with auto-start support!');
  }
}

const hackerNewsFilter = new HackerNewsContentFilter();
hackerNewsFilter.init();
