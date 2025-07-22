console.log('🔧 Great Filter: Shared content base loaded');

class ContentFilterBase {
  constructor() {
    this.processedItems = new Set();
    this.scrollTimeout = null;
    this.isScrollProcessing = false;
    this.currentTopics = null;
    this.isFilteringActive = false;
    this.statistics = {
      totalPosts: 0,
      shownPosts: 0,
      filteredPosts: 0
    };
  }

  sendStatsUpdate() {
    console.log('📊 DEBUG: Sending stats update:', this.statistics);
    chrome.runtime.sendMessage({
      action: 'statsUpdate',
      statistics: {
        totalPosts: this.statistics.totalPosts,
        shownPosts: this.statistics.shownPosts,
        filteredPosts: this.statistics.filteredPosts
      }
    });
  }

  resetStatistics() {
    this.statistics = {
      totalPosts: 0,
      shownPosts: 0,
      filteredPosts: 0
    };
    this.sendStatsUpdate();
  }

  blurWaitingElement(container, title) {
    console.log(`⏳ DEBUG: Applying waiting blur to element: "${title}"`);
    if (!container.style.filter) {
      container.style.filter = 'blur(6px) grayscale(100%) brightness(0.2)';
      container.style.opacity = '0.8';
      container.style.pointerEvents = 'none';
      container.title = `Processing: ${title}`;
      console.log('⏳ Great Filter: Applied heavy waiting blur to element:', title);
    } else {
      console.log('⚠️ DEBUG: Element already filtered:', title);
    }
  }

  blurBlockedElement(container, title) {
    container.style.filter = 'blur(6px) grayscale(100%) brightness(0.2)';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    console.log(`🚫 DEBUG: Applying blocked blur to element: "${title}"`);
    container.title = `Blocked: ${title}`;
    console.log('🚫 Great Filter: Applied blocked blur with reddish tint to element:', title);
  }

  unblurElement(container) {
    console.log('✅ DEBUG: Removing blur from element');
    container.style.filter = '';
    container.style.opacity = '';
    container.style.pointerEvents = '';
    container.title = 'Allowed: Element kept';
  }

  async processElementsBatch(elements, topics, elementType = 'video') {
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
        this.blurWaitingElement(element.container, element.title);
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
          this.unblurElement(element.container);
          console.log(`✅ Great Filter: ${elementType} ${index + 1} allowed: "${element.title}"`);
        } else {
          this.statistics.filteredPosts++;
          this.blurBlockedElement(element.container, element.title);
          console.log(`🚫 Great Filter: ${elementType} ${index + 1} blocked: "${element.title}"`);
        }
      });

      this.sendStatsUpdate();

      console.log(`🎉 DEBUG: Finished processing all ${elementType}s in batch`);
    } catch (error) {
      console.error(`❌ Great Filter: Error in processElementsBatch for ${elementType}s:`, error);
    }
  }

  async handleScroll(extractElementsFunction, elementType = 'video') {
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
            this.blurWaitingElement(element.container, element.title);
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
              this.unblurElement(element.container);
              console.log(`✅ Great Filter: Scroll ${elementType} ${index + 1} allowed: "${element.title}"`);
            } else {
              this.statistics.filteredPosts++;
              this.blurBlockedElement(element.container, element.title);
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

  startScrollMonitoring(topics, extractElementsFunction, elementType = 'video') {
    this.currentTopics = topics;
    window.addEventListener('scroll', () => this.handleScroll(extractElementsFunction, elementType));
    console.log(`📜 DEBUG: ${elementType} scroll monitoring started`);
  }

  stopScrollMonitoring() {
    this.currentTopics = null;
    window.removeEventListener('scroll', this.handleScroll);
    console.log('📜 DEBUG: Scroll monitoring stopped');
  }


  stopFiltering() {
    console.log('🛑 DEBUG: Stopping filtering');
    this.isFilteringActive = false;
    this.stopScrollMonitoring();
  }

  waitForElements(extractElementsFunction, callback, maxAttempts = 50, interval = 100) {
    console.log('🔍 DEBUG: Starting element polling...');
    let attempts = 0;

    const poll = () => {
      attempts++;
      const elements = extractElementsFunction();

      if (elements && elements.length > 0) {
        console.log(`🔍 DEBUG: Found ${elements.length} elements after ${attempts} attempts`);
        callback();
      } else if (attempts < maxAttempts) {
        console.log(`🔍 DEBUG: No elements found, attempt ${attempts}/${maxAttempts}`);
        setTimeout(poll, interval);
      } else {
        console.log('🔍 DEBUG: Max polling attempts reached, proceeding anyway');
        callback();
      }
    };

    poll();
  }

  async checkFilteringState(processElementsFunction, startScrollMonitoringFunction) {
    try {
      const result = await chrome.storage.local.get(['allowedTopics', 'filteringEnabled']);
      const topics = result.allowedTopics || [];
      const filteringEnabled = result.filteringEnabled === true;

      if (topics.length > 0 && filteringEnabled) {
        console.log('🚀 DEBUG: Filtering is enabled, starting with topics:', topics);
        this.isFilteringActive = true;
        processElementsFunction(topics);
        startScrollMonitoringFunction(topics);
      } else {
        console.log('🚀 DEBUG: Filtering is disabled or no topics configured');
      }
    } catch (error) {
      console.error('Error checking filtering state:', error);
    }
  }

  setupMessageListener(processElementsFunction, startScrollMonitoringFunction) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      console.log('📨 DEBUG: Message received in content script:', request);

      if (request.action === 'startFiltering') {
        console.log('🚀 DEBUG: Starting filtering with topics:', request.topics);
        this.resetStatistics();
        this.isFilteringActive = true;
        processElementsFunction(request.topics);
        startScrollMonitoringFunction(request.topics);
        sendResponse({ success: true });
      }

      if (request.action === 'stopFiltering') {
        console.log('🛑 DEBUG: Stopping filtering');
        this.stopFiltering();
        sendResponse({ success: true });
      }

      if (request.action === 'getFilteringState') {
        sendResponse({
          isActive: this.isFilteringActive,
          topics: this.currentTopics
        });
      }

      if (request.action === 'getStatistics') {
        sendResponse({
          statistics: {
            totalPosts: this.statistics.totalPosts,
            shownPosts: this.statistics.shownPosts,
            filteredPosts: this.statistics.filteredPosts
          }
        });
      }

      return true;
    });
  }
}

window.ContentFilterBase = ContentFilterBase;
