console.log('🔧 Great Filter: Shared content base loaded');

const POLLING_INTERVALS = {
  STARTUP_ELEMENT_CHECK: 50,           // How often to check for elements during page load (ms)
  STARTUP_MAX_ATTEMPTS: 50,            // Maximum attempts to find elements during startup
  SCROLL_ACTIVE: 100,                  // Fast polling during active scrolling (ms)
  SCROLL_IDLE: 2000,                   // Slow polling when not scrolling (ms)
  SCROLL_ACTIVITY_TIMEOUT: 2000,       // Time to wait before considering scrolling "stopped" (ms)
};

const VISUAL_EFFECTS = {
  BLUR_RADIUS: '6px',                  // Blur intensity for filtered content
  GRAYSCALE_AMOUNT: '100%',            // Grayscale level for filtered content
  BRIGHTNESS_LEVEL: '0.2',             // Brightness reduction for filtered content
  WAITING_OPACITY: '0.8',              // Opacity while waiting for AI response
  BLOCKED_OPACITY: '0',                // Opacity for blocked content (hidden)
  ALLOWED_OPACITY: '',                 // Opacity for allowed content (normal)
};

const UI_TIMEOUTS = {
  POPUP_MESSAGE_DISPLAY: 3000,         // How long popup messages stay visible (ms)
};

class ContentFilterBase {
  constructor() {
    this.processedItems = new Set();
    this.scrollTimeout = null;
    this.currentTopics = null;
    this.isFilteringActive = false;
    this.pollingInterval = null;
    this.lastScrollTime = 0;
    this.isScrollActive = false;
    this.scrollActivityTimeout = null;
    this.extractElementsFunction = null;
  }


  blurWaitingElement(container, title) {
    console.log(`⏳ DEBUG: Applying waiting blur to element: "${title}"`);
    if (!container.style.filter) {
      container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
      container.style.opacity = VISUAL_EFFECTS.WAITING_OPACITY;
      container.style.pointerEvents = 'none';
      container.title = `Processing: ${title}`;
      console.log('⏳ Great Filter: Applied heavy waiting blur to element:', title);
    } else {
      console.log('⚠️ DEBUG: Element already filtered:', title);
    }
  }

  blurBlockedElement(container, title) {
    container.style.filter = `blur(${VISUAL_EFFECTS.BLUR_RADIUS}) grayscale(${VISUAL_EFFECTS.GRAYSCALE_AMOUNT}) brightness(${VISUAL_EFFECTS.BRIGHTNESS_LEVEL})`;
    container.style.opacity = VISUAL_EFFECTS.BLOCKED_OPACITY;
    container.style.pointerEvents = 'none';
    console.log(`🚫 DEBUG: Applying blocked blur to element: "${title}"`);
    container.title = `Blocked: ${title}`;
    console.log('🚫 Great Filter: Applied blocked blur with reddish tint to element:', title);
  }

  unblurElement(container) {
    console.log('✅ DEBUG: Removing blur from element');
    container.style.filter = '';
    container.style.opacity = VISUAL_EFFECTS.ALLOWED_OPACITY;
    container.style.pointerEvents = '';
    container.title = 'Allowed: Element kept';
  }

  async processElementsBatch(elements, topics, elementType = 'item') {
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
        this.blurWaitingElement(element.container, element.title);
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
        if (response.error === 'DAILY_LIMIT_EXCEEDED') {
          console.warn('🚫 Great Filter: Daily limit exceeded:', response.message);
          this.showDailyLimitMessage(response);
          this.isFilteringActive = false;
          chrome.runtime.sendMessage({ action: 'filteringStopped' });
          return;
        }
        console.error(`❌ Great Filter: Error checking ${elementType}s:`, response.error);
        return;
      }

      console.log(`🎯 DEBUG: Applying batch results to ${elementType}s`);
      response.results.forEach((result, index) => {
        const element = elements[index];
        if (result.isAllowed) {
          this.unblurElement(element.container);
          console.log(`✅ Great Filter: ${elementType} ${index + 1} allowed: "${element.title}"`);
        } else {
          this.blurBlockedElement(element.container, element.title);
          console.log(`🚫 Great Filter: ${elementType} ${index + 1} blocked: "${element.title}"`);
        }
      });

      console.log(`🎉 DEBUG: Finished processing all ${elementType}s in batch`);
    } catch (error) {
      console.error(`❌ Great Filter: Error in processElementsBatch for ${elementType}s:`, error);
    }
  }


  startScrollMonitoring(topics, extractElementsFunction, elementType = 'item') {
    this.currentTopics = topics;
    this.extractElementsFunction = extractElementsFunction;

    this.pollingInterval = setInterval(() => {
      this.pollForNewContent();
    }, this.isScrollActive ? POLLING_INTERVALS.SCROLL_ACTIVE : POLLING_INTERVALS.SCROLL_IDLE);

    window.addEventListener('scroll', () => this.updateScrollActivity());

    console.log(`📜 DEBUG: ${elementType} adaptive polling started (${POLLING_INTERVALS.SCROLL_ACTIVE}ms active / ${POLLING_INTERVALS.SCROLL_IDLE}ms idle)`);
  }

  stopScrollMonitoring() {
    this.currentTopics = null;
    this.extractElementsFunction = null;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.scrollActivityTimeout) {
      clearTimeout(this.scrollActivityTimeout);
      this.scrollActivityTimeout = null;
    }

    window.removeEventListener('scroll', this.updateScrollActivity);

    console.log('📜 DEBUG: Adaptive polling stopped');
  }


  stopFiltering() {
    console.log('🛑 DEBUG: Stopping filtering');
    this.isFilteringActive = false;
    this.stopScrollMonitoring();
  }

  waitForElements(extractElementsFunction, callback, maxAttempts = POLLING_INTERVALS.STARTUP_MAX_ATTEMPTS, interval = POLLING_INTERVALS.STARTUP_ELEMENT_CHECK) {
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

  updateScrollActivity() {
    this.lastScrollTime = Date.now();

    if (!this.isScrollActive) {
      this.isScrollActive = true;
      console.log('📜 DEBUG: Scroll activity detected - switching to active polling');
      this.adjustPollingInterval();
    }

    clearTimeout(this.scrollActivityTimeout);
    this.scrollActivityTimeout = setTimeout(() => {
      this.isScrollActive = false;
      console.log('📜 DEBUG: Scroll activity ended - switching to idle polling');
      this.adjustPollingInterval();
    }, POLLING_INTERVALS.SCROLL_ACTIVITY_TIMEOUT);
  }

  adjustPollingInterval() {
    if (!this.pollingInterval) return;

    clearInterval(this.pollingInterval);

    const interval = this.isScrollActive ? POLLING_INTERVALS.SCROLL_ACTIVE : POLLING_INTERVALS.SCROLL_IDLE;
    console.log(`📜 DEBUG: Adjusting polling interval to ${interval}ms`);

    this.pollingInterval = setInterval(() => {
      this.pollForNewContent();
    }, interval);
  }

  async pollForNewContent() {
    if (!this.currentTopics || !this.extractElementsFunction) return;

    console.log(`📜 DEBUG: Polling for new content (${this.isScrollActive ? 'active' : 'idle'} mode)`);

    const allElements = this.extractElementsFunction();
    const newElements = allElements.filter(element => !this.processedItems.has(element.title));

    if (newElements.length > 0) {
      console.log(`📜 DEBUG: Found ${newElements.length} new elements during polling`);
      await this.processNewElements(newElements);
    }
  }

  async processNewElements(newElements) {
    console.log(`📡 DEBUG: Processing ${newElements.length} new elements`);

    try {
      newElements.forEach(element => {
        this.processedItems.add(element.title);
        this.blurWaitingElement(element.container, element.title);
      });

      chrome.runtime.sendMessage({
        action: 'contentProcessing'
      });

      const response = await chrome.runtime.sendMessage({
        action: 'checkItemTitlesBatch',
        items: newElements.map((element, index) => ({
          index: index + 1,
          title: element.title,
          container: element.container
        })),
        topics: this.currentTopics
      });

      console.log('📡 DEBUG: Polling batch response received:', response);

      if (response.error) {
        if (response.error === 'DAILY_LIMIT_EXCEEDED') {
          console.warn('🚫 Great Filter: Daily limit exceeded:', response.message);
          this.showDailyLimitMessage(response);
          this.isFilteringActive = false;
          chrome.runtime.sendMessage({ action: 'filteringStopped' });
          return;
        }
        console.error('❌ Great Filter: Error checking polling elements:', response.error);
        chrome.runtime.sendMessage({
          action: 'filteringComplete'
        });
        return;
      }

      response.results.forEach((result, index) => {
        const element = newElements[index];

        if (result.isAllowed) {
          this.unblurElement(element.container);
          console.log(`✅ Great Filter: Polling element ${index + 1} allowed: "${element.title}"`);
        } else {
          this.blurBlockedElement(element.container, element.title);
          console.log(`🚫 Great Filter: Polling element ${index + 1} blocked: "${element.title}"`);
        }
      });

      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });

    } catch (error) {
      console.error('❌ Great Filter: Error processing polling elements:', error);
      chrome.runtime.sendMessage({
        action: 'filteringComplete'
      });
    }
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


      return true;
    });
  }

  showDailyLimitMessage(errorResponse) {
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 400px;
      line-height: 1.4;
    `;

    message.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Daily Limit Reached</div>
      <div style="margin-bottom: 8px;">${errorResponse.message}</div>
      <div style="font-size: 12px; opacity: 0.9;">
        Usage: ${errorResponse.currentUsage}/${errorResponse.dailyLimit} posts<br>
        Resets: ${new Date(errorResponse.resetTime).toLocaleString()}
      </div>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 10000);
  }
}

window.ContentFilterBase = ContentFilterBase;
