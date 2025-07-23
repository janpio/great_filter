const OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

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

  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const statusDetails = document.getElementById('statusDetails');
  const currentTopics = document.getElementById('currentTopics');
  const currentTabStats = document.getElementById('currentTabStats');
  const globalApiStats = document.getElementById('globalApiStats');
  let isFiltering = false;

  loadSavedTopics();
  checkCurrentFilteringState();
  updateStatistics();

  let originalTopics = '';

  topicsTextarea.addEventListener('input', function() {
    const currentTopics = topicsTextarea.value.trim();
    if (currentTopics !== originalTopics) {
      saveButton.classList.remove('inactive');
      saveButton.classList.add('active');
    } else {
      saveButton.classList.remove('active');
      saveButton.classList.add('inactive');
    }
  });

  filterButton.addEventListener('click', async function() {
    if (isFiltering) {
      stopFiltering();
      return;
    }

    const result = await chrome.storage.local.get(['allowedTopics']);
    const topics = result.allowedTopics || [];

    if (topics.length === 0) {
      alert('Please configure preferences first');
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

        filterMessage.textContent = 'Filtering started!';
        filterMessage.style.display = 'block';
        setTimeout(() => {
          filterMessage.style.display = 'none';
        }, UI_TIMEOUTS.POPUP_MESSAGE_DISPLAY);
      }
    } catch (error) {
      console.error('Error starting filter:', error);
      alert('Error starting filter. Make sure you are on a supported website: ' + error.message);
    }
  });

  saveButton.addEventListener('click', async function() {
    if (!saveButton.classList.contains('active')) {
      return;
    }

    const topicsText = topicsTextarea.value.trim();
    const topics = topicsText.split('\n').filter(topic => topic.trim() !== '').map(topic => topic.trim());

    if (topics.length === 0) {
      alert('Please enter at least one topic');
      return;
    }

    try {
      await chrome.storage.local.set({
        allowedTopics: topics
      });

      originalTopics = topicsText;
      saveButton.classList.remove('active');
      saveButton.classList.add('inactive');

      savedMessage.style.display = 'block';
      setTimeout(() => {
        savedMessage.style.display = 'none';
      }, UI_TIMEOUTS.POPUP_MESSAGE_DISPLAY);

      updateStatus();

      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        await chrome.tabs.reload(tabs[0].id);
      }

      console.log('Topics saved:', topics);
    } catch (error) {
      console.error('Error saving topics:', error);
      alert('Error saving topics: ' + error.message);
    }
  });

  async function loadSavedTopics() {
    try {
      const result = await chrome.storage.local.get(['allowedTopics']);
      if (result.allowedTopics && result.allowedTopics.length > 0) {
        const topicsText = result.allowedTopics.join('\n');
        topicsTextarea.value = topicsText;
        originalTopics = topicsText;
      }
      saveButton.classList.remove('active');
      saveButton.classList.add('inactive');
      updateStatus();
    } catch (error) {
      console.error('Error loading topics:', error);
      setStatus('inactive', 'Error loading settings');
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
    filterButton.style.backgroundColor = '#dc3545';
    setStatus('running', 'Filtering active', '', topics);
    setTimeout(updateStatistics, UI_TIMEOUTS.STATISTICS_UPDATE_DELAY);
  }

  async function stopFiltering() {
    isFiltering = false;
    filterButton.textContent = 'Start Filtering';
    filterButton.style.backgroundColor = '#2196F3';

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

  async function updateStatistics() {
    console.log('📊 POPUP DEBUG: Requesting statistics...');
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCurrentTabStats'
      });

      console.log('📊 POPUP DEBUG: Received response:', response);

      if (response) {
        const stats = response.statistics;
        const globalCount = response.globalApiRequestCount;

        console.log('📊 POPUP DEBUG: Updating UI with stats:', stats, 'global:', globalCount);
        currentTabStats.textContent = `Showing ${stats.shownPosts} of ${stats.totalPosts} posts`;
        globalApiStats.textContent = globalCount.toString();
      }
    } catch (error) {
      console.log('Could not get statistics:', error);
      currentTabStats.textContent = 'Showing 0 of 0 posts';
      globalApiStats.textContent = '0';
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
  });

});
