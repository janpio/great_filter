// Constants are now imported from shared/content-base.js

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Popup script loaded!');
  const mainToggle = document.getElementById('mainToggle');
  const topicsDisplay = document.getElementById('topicsDisplay');
  const topicsEdit = document.getElementById('topicsEdit');
  const topicsText = document.getElementById('topicsText');
  const topicsEditBtn = document.getElementById('topicsEditBtn');
  const topicsTextarea = document.getElementById('topics');
  const topicsSaveBtn = document.getElementById('topicsSaveBtn');

  const moreBtn = document.getElementById('moreBtn');
  const moreContent = document.getElementById('moreContent');
  const useProxyApiRadio = document.getElementById('useProxyApi');
  const useOwnApiKeyRadio = document.getElementById('useOwnApiKey');
  const apiKeySection = document.getElementById('apiKeySection');
  const apiKeyDisplay = document.getElementById('apiKeyDisplay');
  const apiKeyEdit = document.getElementById('apiKeyEdit');
  const apiKeyText = document.getElementById('apiKeyText');
  const apiKeyEditBtn = document.getElementById('apiKeyEditBtn');
  const apiKeyInput = document.getElementById('apiKey');
  const apiKeySaveBtn = document.getElementById('apiKeySaveBtn');

  const savedMessage = document.getElementById('savedMessage');
  const filterMessage = document.getElementById('filterMessage');
  const infoIcon = document.getElementById('infoIcon');
  const infoTooltip = document.getElementById('infoTooltip');
  const infoTooltipClose = document.getElementById('infoTooltipClose');
  const apiDescription = document.getElementById('apiDescription');

  let isFiltering = false;
  let isOnSupportedSite = false;
  let isMoreExpanded = false;
  let isTopicsEditing = false;
  let isApiKeyEditing = false;
  let usageInfo = null;

  loadSavedTopics();
  loadApiKeySettings();
  checkCurrentFilteringState();
  checkSupportedSite();
  initializeTooltipContent();

  let originalTopics = '';
  let originalUseOwnApiKey = false;
  let originalApiKey = '';
  let currentTopicsArray = [];

  function autoResizeTextarea() {
    topicsTextarea.style.height = '80px';
    const scrollHeight = topicsTextarea.scrollHeight;
    const maxHeight = 120;
    const newHeight = Math.min(scrollHeight, maxHeight);
    topicsTextarea.style.height = newHeight + 'px';
  }

  mainToggle.addEventListener('click', function() {
    if (!isOnSupportedSite) {
      return;
    }

    if (isFiltering) {
      stopFiltering();
    } else {
      startFilteringAction();
    }
  });

  moreBtn.addEventListener('click', function() {
    console.log('🖱️ More button clicked, current state:', { isMoreExpanded, useProxyChecked: useProxyApiRadio.checked });
    toggleMoreSection();
  });

  topicsEditBtn.addEventListener('click', function() {
    enterTopicsEditMode();
  });

  topicsSaveBtn.addEventListener('click', function() {
    if (topicsSaveBtn.classList.contains('active')) {
      saveTopics();
    }
  });

  apiKeyEditBtn.addEventListener('click', function() {
    enterApiKeyEditMode();
  });

  apiKeySaveBtn.addEventListener('click', function() {
    if (apiKeySaveBtn.classList.contains('active')) {
      saveApiKey();
    }
  });

  topicsTextarea.addEventListener('input', function() {
    autoResizeTextarea();
    checkTopicsForChanges();
  });

  apiKeyInput.addEventListener('input', function() {
    checkApiKeyForChanges();
  });

  useProxyApiRadio.addEventListener('change', function() {
    console.log('📻 Proxy radio clicked, current state:', { isMoreExpanded, checked: useProxyApiRadio.checked });
    handleApiChoiceChange();
  });

  useOwnApiKeyRadio.addEventListener('change', function() {
    console.log('📻 Own API radio clicked, current state:', { isMoreExpanded, checked: useOwnApiKeyRadio.checked });
    handleApiChoiceChange();
  });

  infoIcon.addEventListener('click', function() {
    showInfoTooltip();
  });

  infoTooltip.addEventListener('click', function(e) {
    if (e.target === infoTooltip) {
      hideInfoTooltip();
    }
  });

  infoTooltipClose.addEventListener('click', function() {
    hideInfoTooltip();
  });

  const reviewLink = document.getElementById('reviewLink');
  reviewLink.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://chrome.google.com/webstore/detail/mbifgfgfbnemojmfkckodkikibihcgaj/reviews'
    });
  });

  function checkTopicsForChanges() {
    const currentTopics = topicsTextarea.value.trim();
    const hasChanges = currentTopics !== originalTopics;

    if (hasChanges) {
      topicsSaveBtn.classList.remove('inactive');
      topicsSaveBtn.classList.add('active');
    } else {
      topicsSaveBtn.classList.remove('active');
      topicsSaveBtn.classList.add('inactive');
    }
  }

  function checkApiKeyForChanges() {
    const currentApiKey = apiKeyInput.value.trim();
    const hasChanges = currentApiKey !== originalApiKey;

    if (hasChanges) {
      apiKeySaveBtn.classList.remove('inactive');
      apiKeySaveBtn.classList.add('active');
    } else {
      apiKeySaveBtn.classList.remove('active');
      apiKeySaveBtn.classList.add('inactive');
    }
  }

  async function startFilteringAction() {
    const result = await chrome.storage.local.get(['allowedTopics']);
    const topics = result.allowedTopics || [];

    if (topics.length === 0) {
      showMessage('Please configure topics first', true);
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

        startFiltering();

        await chrome.tabs.reload(tabs[0].id);

        showMessage('Filtering started!');
      }
    } catch (error) {
      console.error('Error starting filter:', error);
      showMessage('Error starting filter. Make sure you are on a supported website.', true);
    }
  }

  async function saveTopics() {
    const topicsText = topicsTextarea.value.trim();
    const topics = topicsText.split('\n').filter(topic => topic.trim() !== '').map(topic => topic.trim());

    if (topics.length === 0) {
      showMessage('Please enter at least one topic', true);
      return;
    }

    try {
      await chrome.storage.local.set({
        allowedTopics: topics
      });

      originalTopics = topicsText;
      currentTopicsArray = topics;
      exitTopicsEditMode();
      updateTopicsDisplay();

      showMessage('Topics saved successfully!');

      // Only reload if filtering is currently enabled
      if (isFiltering) {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
          await chrome.tabs.reload(tabs[0].id);
        }
      }

      console.log('Topics saved:', topics);
    } catch (error) {
      console.error('Error saving topics:', error);
      showMessage('Error saving topics: ' + error.message, true);
    }
  }

  async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    const useOwnApiKey = useOwnApiKeyRadio.checked;

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
        useOwnApiKey: useOwnApiKey,
        apiKey: apiKey
      });

      originalUseOwnApiKey = useOwnApiKey;
      originalApiKey = apiKey;
      exitApiKeyEditMode();
      updateApiKeyDisplay();

      showMessage('API key saved successfully!');

      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        await chrome.tabs.reload(tabs[0].id);
      }

      console.log('API key saved:', { useOwnApiKey, hasApiKey: !!apiKey });
    } catch (error) {
      console.error('Error saving API key:', error);
      showMessage('Error saving API key: ' + error.message, true);
    }
  }

  async function loadSavedTopics() {
    try {
      const result = await chrome.storage.local.get(['allowedTopics']);
      if (result.allowedTopics && result.allowedTopics.length > 0) {
        currentTopicsArray = result.allowedTopics;
        const topicsText = result.allowedTopics.join('\n');
        topicsTextarea.value = topicsText;
        originalTopics = topicsText;
        updateTopicsDisplay();
        autoResizeTextarea();
      } else {
        currentTopicsArray = [];
        updateTopicsDisplay();
      }
      updateToggleState();
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  }

  async function loadApiKeySettings() {
    try {
      const result = await chrome.storage.local.get(['useOwnApiKey', 'apiKey']);
      const useOwnApiKey = result.useOwnApiKey === true;
      const apiKey = result.apiKey || '';

      if (useOwnApiKey) {
        useOwnApiKeyRadio.checked = true;
        useProxyApiRadio.checked = false;
      } else {
        useProxyApiRadio.checked = true;
        useOwnApiKeyRadio.checked = false;
      }
      apiKeyInput.value = apiKey;

      originalUseOwnApiKey = useOwnApiKey;
      originalApiKey = apiKey;

      updateApiKeyDisplay();
      updateApiKeyVisibility();
      updateApiDescription();
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
              startFiltering();
            } else {
              updateToggleState();
            }
          } catch (error) {
            console.log('Could not check filtering state (probably not on supported site):', error);
            updateToggleState();
          }
        } else {
          updateToggleState();
        }
      } else {
        updateToggleState();
      }
    } catch (error) {
      console.error('Error checking filtering state:', error);
      updateToggleState();
    }
  }

  async function updateToggleState() {
    try {
      const result = await chrome.storage.local.get(['allowedTopics', 'filteringEnabled']);
      const topics = result.allowedTopics || [];
      const filteringEnabled = result.filteringEnabled === true;

      if (topics.length > 0 && filteringEnabled && isOnSupportedSite) {
        mainToggle.classList.remove('inactive');
        mainToggle.classList.add('active');
        isFiltering = true;
      } else {
        mainToggle.classList.remove('active');
        mainToggle.classList.add('inactive');
        isFiltering = false;
      }

      updateMainToggleState();
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }

  function startFiltering() {
    isFiltering = true;
    mainToggle.classList.remove('inactive');
    mainToggle.classList.add('active');
    updateMainToggleState();
  }

  async function stopFiltering() {
    isFiltering = false;
    mainToggle.classList.remove('active');
    mainToggle.classList.add('inactive');
    updateMainToggleState();

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
  }

  function updateMainToggleState() {
    if (!isOnSupportedSite) {
      mainToggle.style.opacity = '0.5';
      mainToggle.style.cursor = 'not-allowed';
      mainToggle.title = 'Unsupported website';
    } else {
      mainToggle.style.opacity = '1';
      mainToggle.style.cursor = 'pointer';
      mainToggle.title = isFiltering ? 'Stop filtering' : 'Start filtering';
    }
  }

  function toggleMoreSection() {
    isMoreExpanded = !isMoreExpanded;
    if (isMoreExpanded) {
      moreContent.classList.remove('hidden');
      moreBtn.textContent = 'Less';
      // Check usage if free tier is selected
      if (useProxyApiRadio.checked) {
        console.log('🔄 More section expanded with free tier selected - checking usage...');
        checkUsageAvailability();
      }
    } else {
      moreContent.classList.add('hidden');
      moreBtn.textContent = 'More';
    }
  }

  function enterTopicsEditMode() {
    isTopicsEditing = true;
    topicsDisplay.classList.add('hidden');
    topicsEdit.classList.remove('hidden');
    topicsTextarea.focus();
    autoResizeTextarea();
    checkTopicsForChanges();
  }

  function exitTopicsEditMode() {
    isTopicsEditing = false;
    topicsEdit.classList.add('hidden');
    topicsDisplay.classList.remove('hidden');
    topicsSaveBtn.classList.remove('active');
    topicsSaveBtn.classList.add('inactive');
  }

  function enterApiKeyEditMode() {
    isApiKeyEditing = true;
    apiKeyDisplay.classList.add('hidden');
    apiKeyEdit.classList.remove('hidden');
    apiKeyInput.focus();
    checkApiKeyForChanges();
  }

  function exitApiKeyEditMode() {
    isApiKeyEditing = false;
    apiKeyEdit.classList.add('hidden');
    apiKeyDisplay.classList.remove('hidden');
    apiKeySaveBtn.classList.remove('active');
    apiKeySaveBtn.classList.add('inactive');
  }

  function updateTopicsDisplay() {
    if (currentTopicsArray.length > 0) {
      topicsText.textContent = currentTopicsArray.join(', ');
    } else {
      topicsText.textContent = 'No preferences configured';
    }
  }

  function updateApiKeyDisplay() {
    if (originalUseOwnApiKey && originalApiKey) {
      apiKeyText.textContent = 'API Key configured';
    } else {
      apiKeyText.textContent = 'No API key configured';
    }
  }

  function updateApiKeyVisibility() {
    if (useOwnApiKeyRadio.checked) {
      apiKeySection.classList.remove('hidden');
    } else {
      apiKeySection.classList.add('hidden');
    }
  }

  function handleApiChoiceChange() {
    updateApiKeyVisibility();
    updateApiDescription();

    // Check usage if switching to free tier and More is expanded
    if (useProxyApiRadio.checked && isMoreExpanded) {
      console.log('🔄 Switched to free tier with More expanded - checking usage...');
      checkUsageAvailability();
    }

    chrome.storage.local.set({
      useOwnApiKey: useOwnApiKeyRadio.checked
    }).then(() => {
      originalUseOwnApiKey = useOwnApiKeyRadio.checked;
      console.log('API choice updated:', useOwnApiKeyRadio.checked ? 'own' : 'proxy');
    }).catch(error => {
      console.error('Error updating API choice:', error);
    });
  }

  function updateApiDescription() {
    console.log('🎨 updateApiDescription called - useOwnApiKey:', useOwnApiKeyRadio.checked, 'usageInfo:', usageInfo);

    if (useOwnApiKeyRadio.checked) {
      apiDescription.innerHTML = API_DESCRIPTIONS.YOUR_API_KEY;
    } else {
      const baseText = API_DESCRIPTIONS.FREE_TIER;

      if (usageInfo) {
        if (usageInfo.hasQueriesAvailable) {
          const newText = `${baseText}\n✅ Available`;
          console.log('🎨 Setting description to (available):', newText);
          apiDescription.textContent = newText;
        } else {
          const resetTime = usageInfo.resetTime ? new Date(usageInfo.resetTime).toLocaleString(undefined, {
            hour: 'numeric',
            minute: '2-digit'
          }) : 'midnight UTC';
          const newText = `${baseText}\n❌ Global daily quota reached. Resets at ${resetTime}.`;
          console.log('🎨 Setting description to (limited):', newText);
          apiDescription.textContent = newText;
        }
      } else {
        console.log('🎨 Setting description to (no usage info):', baseText);
        apiDescription.textContent = baseText;
      }
    }
  }

  function showInfoTooltip() {
    infoTooltip.classList.add('show');
  }

  function hideInfoTooltip() {
    infoTooltip.classList.remove('show');
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

  async function checkSupportedSite() {
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        const url = tabs[0].url;
        isOnSupportedSite = isSupportedWebsite(url);
        updateMainToggleState();
      }
    } catch (error) {
      console.error('Error checking supported site:', error);
      isOnSupportedSite = false;
      updateMainToggleState();
    }
  }

  function isSupportedWebsite(url) {
    if (!url) return false;

    const supportedPatterns = [
      /^https:\/\/www\.youtube\.com\/.*/,
      /^https:\/\/news\.ycombinator\.com\/(?!item).*/,
      /^https:\/\/.*\.reddit\.com\/.*/,
      /^https:\/\/x\.com\/.*/
    ];

    return supportedPatterns.some(pattern => pattern.test(url));
  }

  async function checkUsageAvailability() {
    try {
      const usageUrl = 'https://great-filter-vps.vercel.app/api/usage';
      console.log('📡 Making usage request to:', usageUrl);

      const response = await fetch(usageUrl);
      console.log('📡 Usage response status:', response.status);

      if (!response.ok) {
        throw new Error(`Usage check failed: ${response.status}`);
      }

      usageInfo = await response.json();
      console.log('✅ Usage info received:', usageInfo);

      updateApiDescription();
      console.log('🎨 API description updated with usage info');

    } catch (error) {
      console.error('❌ Error checking usage availability:', error);
      usageInfo = null;
      updateApiDescription();
    }
  }

  function initializeTooltipContent() {
    // About section content
    const aboutTitle = document.getElementById('aboutTitle');
    const aboutDescription = document.getElementById('aboutDescription');
    const howItWorksTitle = document.getElementById('howItWorksTitle');
    const howItWorks = document.getElementById('howItWorks');
    const apiTiersTitle = document.getElementById('apiTiersTitle');
    const supportedSitesTitle = document.getElementById('supportedSitesTitle');
    const supportedSites = document.getElementById('supportedSites');
    const creditsTitle = document.getElementById('creditsTitle');
    const credits = document.getElementById('credits');

    // API descriptions
    const tooltipFreeTier = document.getElementById('tooltipFreeTier');
    const tooltipFreeTierDesc = document.getElementById('tooltipFreeTierDesc');
    const tooltipYourApiKey = document.getElementById('tooltipYourApiKey');
    const tooltipYourApiKeyDesc = document.getElementById('tooltipYourApiKeyDesc');

    // Populate About content
    if (aboutTitle) {
      aboutTitle.textContent = ABOUT_CONTENT.TITLE;
    }
    if (aboutDescription) {
      aboutDescription.textContent = ABOUT_CONTENT.DESCRIPTION;
    }
    if (howItWorksTitle) {
      howItWorksTitle.textContent = ABOUT_CONTENT.HOW_IT_WORKS_TITLE;
    }
    if (howItWorks) {
      howItWorks.textContent = ABOUT_CONTENT.HOW_IT_WORKS;
    }
    if (apiTiersTitle) {
      apiTiersTitle.textContent = ABOUT_CONTENT.API_TIERS_TITLE;
    }
    if (supportedSitesTitle) {
      supportedSitesTitle.textContent = ABOUT_CONTENT.SUPPORTED_SITES_TITLE;
    }
    if (supportedSites) {
      supportedSites.textContent = ABOUT_CONTENT.SUPPORTED_SITES;
    }
    if (creditsTitle) {
      creditsTitle.textContent = ABOUT_CONTENT.CREDITS_TITLE;
    }
    if (credits) {
      credits.innerHTML = ABOUT_CONTENT.CREDITS;
    }

    // Populate API descriptions
    if (tooltipFreeTier) {
      tooltipFreeTier.textContent = API_DESCRIPTIONS.FREE_TIER_TITLE;
    }
    if (tooltipFreeTierDesc) {
      tooltipFreeTierDesc.textContent = API_DESCRIPTIONS.FREE_TIER;
    }
    if (tooltipYourApiKey) {
      tooltipYourApiKey.textContent = API_DESCRIPTIONS.YOUR_API_KEY_TOOLTIP;
    }
    if (tooltipYourApiKeyDesc) {
      tooltipYourApiKeyDesc.innerHTML = API_DESCRIPTIONS.YOUR_API_KEY;
    }
  }

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'filteringStarted') {
      console.log('Auto-filtering started with topics:', request.topics);
      startFiltering();
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
