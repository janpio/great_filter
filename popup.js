const UI_TIMEOUTS = {
  POPUP_MESSAGE_DISPLAY: 3000,         // How long popup messages stay visible (ms)
};

document.addEventListener('DOMContentLoaded', function() {
  const topicsTextarea = document.getElementById('topics');
  const saveButton = document.getElementById('saveButton');
  const savedMessage = document.getElementById('savedMessage');
  const filterButton = document.getElementById('filterButton');
  const filterMessage = document.getElementById('filterMessage');
  const useOwnApiKeyCheckbox = document.getElementById('useOwnApiKey');
  const apiKeyInput = document.getElementById('apiKey');

  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const statusDetails = document.getElementById('statusDetails');
  const currentTopics = document.getElementById('currentTopics');

  const dailyUsageGroup = document.getElementById('dailyUsageGroup');
  const dailyUsage = document.getElementById('dailyUsage');
  const dailyRemaining = document.getElementById('dailyRemaining');
  const dailyReset = document.getElementById('dailyReset');
  let isFiltering = false;
  let isOnSupportedSite = false;

  loadSavedTopics();
  loadApiKeySettings();
  checkCurrentFilteringState();
  checkDailyUsageDisplay();
  checkSupportedSite();

  let originalTopics = '';
  let originalUseOwnApiKey = false;
  let originalApiKey = '';

  function autoResizeTextarea() {
    topicsTextarea.style.height = '40px';
    const scrollHeight = topicsTextarea.scrollHeight;
    const maxHeight = 200;
    const newHeight = Math.min(scrollHeight, maxHeight);
    topicsTextarea.style.height = newHeight + 'px';
  }

  topicsTextarea.addEventListener('input', function() {
    autoResizeTextarea();
    checkForChanges();
  });

  useOwnApiKeyCheckbox.addEventListener('change', function() {
    checkForChanges();
    checkDailyUsageDisplay();
  });

  apiKeyInput.addEventListener('input', function() {
    checkForChanges();
  });

  function checkForChanges() {
    const currentTopics = topicsTextarea.value.trim();
    const currentUseOwnApiKey = useOwnApiKeyCheckbox.checked;
    const currentApiKey = apiKeyInput.value.trim();

    const hasChanges = currentTopics !== originalTopics ||
                      currentUseOwnApiKey !== originalUseOwnApiKey ||
                      currentApiKey !== originalApiKey;

    if (hasChanges) {
      saveButton.classList.remove('inactive');
      saveButton.classList.add('active');
    } else {
      saveButton.classList.remove('active');
      saveButton.classList.add('inactive');
    }
  }

  filterButton.addEventListener('click', async function() {
    if (!isOnSupportedSite) {
      return;
    }

    if (isFiltering) {
      stopFiltering();
      return;
    }

    const result = await chrome.storage.local.get(['allowedTopics']);
    const topics = result.allowedTopics || [];

    if (topics.length === 0) {
      showMessage('Please configure preferences first', true);
      return;
    }

    try {
      await chrome.storage.local.set({
        filteringEnabled: true
      });

      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'startFiltering',
          topics: topics
        });

        chrome.runtime.sendMessage({
          action: 'filteringStarted',
          topics: topics
        });

        startFiltering(topics);

        await chrome.tabs.reload(tabs[0].id);

        showMessage('Filtering started!');
      }
    } catch (error) {
      console.error('Error starting filter:', error);
      showMessage('Error starting filter. Make sure you are on a supported website.', true);
    }
  });

  saveButton.addEventListener('click', async function() {
    if (!saveButton.classList.contains('active')) {
      return;
    }

    const topicsText = topicsTextarea.value.trim();
    const topics = topicsText.split('\n').filter(topic => topic.trim() !== '').map(topic => topic.trim());
    const useOwnApiKey = useOwnApiKeyCheckbox.checked;
    const apiKey = apiKeyInput.value.trim();

    if (topics.length === 0) {
      showMessage('Please enter at least one topic', true);
      return;
    }

    if (useOwnApiKey && !apiKey) {
      showMessage('Please enter your OpenRouter API key', true);
      return;
    }

    if (useOwnApiKey && !apiKey.startsWith('sk-or-')) {
      showMessage('OpenRouter API key should start with "sk-or-"', true);
      return;
    }

    try {
      await chrome.storage.local.set({
        allowedTopics: topics,
        useOwnApiKey: useOwnApiKey,
        apiKey: apiKey
      });

      originalTopics = topicsText;
      originalUseOwnApiKey = useOwnApiKey;
      originalApiKey = apiKey;
      saveButton.classList.remove('active');
      saveButton.classList.add('inactive');

      showMessage('Preferences saved successfully!');

      updateStatus();

      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        await chrome.tabs.reload(tabs[0].id);
      }

      console.log('Settings saved:', { topics, useOwnApiKey, hasApiKey: !!apiKey });
    } catch (error) {
      console.error('Error saving preferences:', error);
      showMessage('Error saving preferences: ' + error.message, true);
    }
  });

  async function loadSavedTopics() {
    try {
      const result = await chrome.storage.local.get(['allowedTopics']);
      if (result.allowedTopics && result.allowedTopics.length > 0) {
        const topicsText = result.allowedTopics.join('\n');
        topicsTextarea.value = topicsText;
        originalTopics = topicsText;
        autoResizeTextarea();
      }
      saveButton.classList.remove('active');
      saveButton.classList.add('inactive');
      updateStatus();
    } catch (error) {
      console.error('Error loading topics:', error);
      setStatus('inactive', 'Error loading settings');
    }
  }

  async function loadApiKeySettings() {
    try {
      const result = await chrome.storage.local.get(['useOwnApiKey', 'apiKey']);
      const useOwnApiKey = result.useOwnApiKey === true;
      const apiKey = result.apiKey || '';

      useOwnApiKeyCheckbox.checked = useOwnApiKey;
      apiKeyInput.value = apiKey;

      originalUseOwnApiKey = useOwnApiKey;
      originalApiKey = apiKey;
    } catch (error) {
      console.error('Error loading API key settings:', error);
    }
  }

  async function checkCurrentFilteringState() {
    try {
      const result = await chrome.storage.local.get(['filteringEnabled', 'allowedTopics']);
      const filteringEnabled = result.filteringEnabled === true;
      const topics = result.allowedTopics || [];

      if (filteringEnabled && topics.length > 0) {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
          try {
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
              action: 'getFilteringState'
            });

            if (response && response.isActive) {
              console.log('Filtering is already active, syncing popup state');
              isFiltering = true;
              startFiltering(response.topics || []);
            } else {
              updateStatus();
            }
          } catch (error) {
            console.log('Could not check filtering state (probably not on supported site):', error);
            updateStatus();
          }
        } else {
          updateStatus();
        }
      } else {
        updateStatus();
      }
    } catch (error) {
      console.error('Error checking filtering state:', error);
      updateStatus();
    }
  }

  async function updateStatus() {
    try {
      const result = await chrome.storage.local.get(['allowedTopics', 'filteringEnabled']);
      const topics = result.allowedTopics || [];
      const filteringEnabled = result.filteringEnabled === true;

      if (topics.length > 0 && filteringEnabled) {
        setStatus('inactive', 'Filtering enabled', `${topics.length} topic${topics.length > 1 ? 's' : ''} configured`, topics);
      } else if (topics.length > 0 && !filteringEnabled) {
        setStatus('inactive', 'Filtering disabled', `${topics.length} topic${topics.length > 1 ? 's' : ''} configured`, topics);
      } else {
        setStatus('inactive', 'No topics configured', 'Enter preferences below to get started');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus('inactive', 'Error checking status');
    }
  }

  function startFiltering(topics) {
    isFiltering = true;
    filterButton.textContent = 'Stop Filtering';
    updateFilterButtonState();
    setStatus('running', 'Filtering active', '', topics);
  }

  async function stopFiltering() {
    isFiltering = false;
    filterButton.textContent = 'Start Filtering';
    updateFilterButtonState();

    try {
      await chrome.storage.local.set({
        filteringEnabled: false
      });

      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'stopFiltering'
        });

        chrome.runtime.sendMessage({
          action: 'filteringStopped'
        });

        await chrome.tabs.reload(tabs[0].id);
      }
    } catch (error) {
      console.error('Error stopping filter:', error);
    }

    const result = await chrome.storage.local.get(['allowedTopics']);
    const topics = result.allowedTopics || [];
    setStatus('inactive', 'Filtering stopped', 'Extension disabled', topics);
  }

  function setStatus(state, text, details = '', topics = []) {
    statusIndicator.className = `status-indicator ${state}`;
    statusText.textContent = text;
    statusDetails.textContent = details;

    if (topics.length > 0) {
      currentTopics.textContent = `Topics: ${topics.join(', ')}`;
      currentTopics.style.display = 'block';
    } else {
      currentTopics.style.display = 'none';
    }
  }


  function showMessage(text, isError = false) {
    const messageEl = document.createElement('div');
    messageEl.className = isError ? 'message error' : 'message';
    messageEl.textContent = text;
    document.body.appendChild(messageEl);

    setTimeout(() => {
      messageEl.remove();
    }, UI_TIMEOUTS.POPUP_MESSAGE_DISPLAY);
  }

  function updateDailyUsage(usageInfo) {
    if (!usageInfo) return;

    console.log('📊 POPUP DEBUG: Updating daily usage info:', usageInfo);

    const usage = `${usageInfo.currentUsage} / ${usageInfo.dailyLimit}`;
    const remaining = usageInfo.remaining.toString();
    const resetTime = new Date(usageInfo.resetTime).toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: 'UTC'
    }) + ' UTC';

    dailyUsage.textContent = usage;
    dailyRemaining.textContent = remaining;
    dailyReset.textContent = resetTime;

    dailyUsageGroup.style.display = 'block';
  }

  async function checkDailyUsageDisplay() {
    try {
      const result = await chrome.storage.local.get(['useOwnApiKey']);
      const useOwnApiKey = result.useOwnApiKey === true;

      if (useOwnApiKey) {
        dailyUsageGroup.style.display = 'none';
      } else {
        dailyUsageGroup.style.display = 'block';
      }
    } catch (error) {
      console.error('Error checking daily usage display:', error);
    }
  }

  async function checkSupportedSite() {
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        const url = tabs[0].url;
        isOnSupportedSite = isSupportedWebsite(url);
        updateFilterButtonState();
      }
    } catch (error) {
      console.error('Error checking supported site:', error);
      isOnSupportedSite = false;
      updateFilterButtonState();
    }
  }

  function isSupportedWebsite(url) {
    if (!url) return false;

    const supportedPatterns = [
      /^https:\/\/www\.youtube\.com\/.*/,
      /^https:\/\/news\.ycombinator\.com\/(?!item).*/
    ];

    return supportedPatterns.some(pattern => pattern.test(url));
  }

  function updateFilterButtonState() {
    if (!isOnSupportedSite) {
      filterButton.classList.remove('btn-primary', 'btn-stop');
      filterButton.classList.add('btn-disabled');
      filterButton.title = 'Unsupported website';
      filterButton.disabled = true;
    } else {
      filterButton.classList.remove('btn-disabled');
      filterButton.title = '';
      filterButton.disabled = false;
      if (isFiltering) {
        filterButton.classList.remove('btn-primary');
        filterButton.classList.add('btn-stop');
      } else {
        filterButton.classList.remove('btn-stop');
        filterButton.classList.add('btn-primary');
      }
    }
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'filteringStarted') {
      console.log('Auto-filtering started with topics:', request.topics);
      startFiltering(request.topics);
    }

    if (request.action === 'dailyUsageUpdate') {
      console.log('Daily usage updated:', request.usageInfo);
      updateDailyUsage(request.usageInfo);
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    checkSupportedSite();
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) {
      checkSupportedSite();
    }
  });

});
