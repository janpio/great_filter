const UI_TIMEOUTS = {
  POPUP_MESSAGE_DISPLAY: 3000,         // How long popup messages stay visible (ms)
  STATISTICS_UPDATE_DELAY: 1000,       // Delay before updating statistics in popup (ms)
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
  const currentTabStats = document.getElementById('currentTabStats');
  const inputTokens = document.getElementById('inputTokens');
  const outputTokens = document.getElementById('outputTokens');
  const totalCost = document.getElementById('totalCost');

  const todayStats = document.getElementById('todayStats');
  const todayInputTokens = document.getElementById('todayInputTokens');
  const todayOutputTokens = document.getElementById('todayOutputTokens');
  const todayCost = document.getElementById('todayCost');

  const totalTabStats = document.getElementById('totalTabStats');
  const totalInputTokens = document.getElementById('totalInputTokens');
  const totalOutputTokens = document.getElementById('totalOutputTokens');
  const totalTabCost = document.getElementById('totalTabCost');

  const dailyUsageGroup = document.getElementById('dailyUsageGroup');
  const dailyUsage = document.getElementById('dailyUsage');
  const dailyRemaining = document.getElementById('dailyRemaining');
  const dailyReset = document.getElementById('dailyReset');

  const statsToggle = document.getElementById('statsToggle');
  const statsSection = document.getElementById('statsSection');
  let isFiltering = false;

  loadSavedTopics();
  loadApiKeySettings();
  checkCurrentFilteringState();
  updateStatistics();
  initializeStatsToggle();
  checkDailyUsageDisplay();

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
    filterButton.classList.remove('btn-primary');
    filterButton.classList.add('btn-stop');
    setStatus('running', 'Filtering active', '', topics);
    setTimeout(updateStatistics, UI_TIMEOUTS.STATISTICS_UPDATE_DELAY);
  }

  async function stopFiltering() {
    isFiltering = false;
    filterButton.textContent = 'Start Filtering';
    filterButton.classList.remove('btn-stop');
    filterButton.classList.add('btn-primary');

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

  async function initializeStatsToggle() {
    try {
      const result = await chrome.storage.local.get(['statsExpanded']);
      const isExpanded = result.statsExpanded === true;

      if (isExpanded) {
        showStats();
      } else {
        hideStats();
      }
    } catch (error) {
      console.error('Error loading stats toggle state:', error);
      hideStats();
    }

    statsToggle.addEventListener('click', toggleStats);
  }

  async function toggleStats() {
    const isCurrentlyVisible = statsSection.style.display !== 'none';

    if (isCurrentlyVisible) {
      hideStats();
      await chrome.storage.local.set({ statsExpanded: false });
    } else {
      showStats();
      await chrome.storage.local.set({ statsExpanded: true });
    }
  }

  function showStats() {
    statsSection.style.display = 'block';
    statsToggle.textContent = 'Hide Statistics';
  }

  function hideStats() {
    statsSection.style.display = 'none';
    statsToggle.textContent = 'Show Statistics';
  }

  async function updateStatistics() {
    console.log('📊 POPUP DEBUG: Requesting all statistics...');

    try {
      const [currentResponse, todayResponse, totalResponse] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getCurrentTabStats' }),
        chrome.runtime.sendMessage({ action: 'getTodayStats' }),
        chrome.runtime.sendMessage({ action: 'getTotalStats' })
      ]);

      console.log('📊 POPUP DEBUG: Received responses:', { currentResponse, todayResponse, totalResponse });

      if (currentResponse) {
        const stats = currentResponse.statistics;
        const tokenUsage = currentResponse.tokenUsage || { inputTokens: 0, outputTokens: 0, totalCost: 0 };

        console.log('📊 POPUP DEBUG: Updating current tab UI with stats:', stats, 'tokens:', tokenUsage);
        currentTabStats.textContent = `${stats.shownPosts} of ${stats.totalPosts}`;
        inputTokens.textContent = tokenUsage.inputTokens.toString();
        outputTokens.textContent = tokenUsage.outputTokens.toString();
        totalCost.textContent = tokenUsage.totalCost.toFixed(6);
      }

      if (todayResponse) {
        console.log('📊 POPUP DEBUG: Updating today UI with stats:', todayResponse);
        todayStats.textContent = `${todayResponse.shownPosts} of ${todayResponse.totalPosts}`;
        todayInputTokens.textContent = todayResponse.inputTokens.toString();
        todayOutputTokens.textContent = todayResponse.outputTokens.toString();
        todayCost.textContent = todayResponse.totalCost.toFixed(6);
      }

      if (totalResponse) {
        console.log('📊 POPUP DEBUG: Updating total UI with stats:', totalResponse);
        totalTabStats.textContent = `${totalResponse.shownPosts} of ${totalResponse.totalPosts}`;
        totalInputTokens.textContent = totalResponse.inputTokens.toString();
        totalOutputTokens.textContent = totalResponse.outputTokens.toString();
        totalTabCost.textContent = totalResponse.totalCost.toFixed(6);
      }
    } catch (error) {
      console.log('Could not get statistics:', error);
      currentTabStats.textContent = '0 of 0';
      inputTokens.textContent = '0';
      outputTokens.textContent = '0';
      totalCost.textContent = '0.000000';

      todayStats.textContent = '0 of 0';
      todayInputTokens.textContent = '0';
      todayOutputTokens.textContent = '0';
      todayCost.textContent = '0.000000';

      totalTabStats.textContent = '0 of 0';
      totalInputTokens.textContent = '0';
      totalOutputTokens.textContent = '0';
      totalTabCost.textContent = '0.000000';
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

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'filteringStarted') {
      console.log('Auto-filtering started with topics:', request.topics);
      startFiltering(request.topics);
    }

    if (request.action === 'tabStatsUpdated') {
      console.log('Statistics updated:', request.statistics);
      updateStatistics();
    }

    if (request.action === 'dailyUsageUpdate') {
      console.log('Daily usage updated:', request.usageInfo);
      updateDailyUsage(request.usageInfo);
    }
  });

});
