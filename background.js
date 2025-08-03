console.log('🔧 Great Filter: Background worker loaded');

importScripts('config.js');
importScripts('shared/prompts.js');

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
  STATISTICS_UPDATE_DELAY: 1000,       // Delay before updating statistics in popup (ms)
};

let lastApiCall = 0;
const MIN_API_INTERVAL = 100;

const tabFilteringStates = new Map();
const tabStatistics = new Map();
const tabTokenUsage = new Map();
let globalApiRequestCount = 0;
let dailyStats = {};
let totalStats = {};
let lastResetDate = '';

initializeGlobalApiCounter();
initializeStatisticsStorage();

async function getApiConfiguration() {
  try {
    const result = await chrome.storage.local.get(['useOwnApiKey', 'apiKey']);
    const useOwnApiKey = result.useOwnApiKey === true;
    const apiKey = result.apiKey || '';

    return {
      useOwnApiKey,
      apiKey,
      url: useOwnApiKey ? CONFIG.OPENROUTER_API_URL : CONFIG.PROXY_URL,
      headers: useOwnApiKey ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://great-filter.extension',
        'X-Title': 'Great Filter Extension'
      } : {
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    console.error('Error getting API configuration:', error);
    return {
      useOwnApiKey: false,
      apiKey: '',
      url: CONFIG.PROXY_URL,
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

async function initializeGlobalApiCounter() {
  try {
    const result = await chrome.storage.local.get(['globalApiRequestCount']);
    globalApiRequestCount = result.globalApiRequestCount || 0;
    console.log('🔧 BACKGROUND DEBUG: Initialized global API counter:', globalApiRequestCount);
  } catch (error) {
    console.error('Error initializing global API counter:', error);
    globalApiRequestCount = 0;
  }
}

async function initializeStatisticsStorage() {
  try {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['dailyStats', 'totalStats', 'lastResetDate']);

    dailyStats = result.dailyStats || {};
    totalStats = result.totalStats || {
      totalPosts: 0,
      shownPosts: 0,
      filteredPosts: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0
    };
    lastResetDate = result.lastResetDate || today;

    if (lastResetDate !== today) {
      lastResetDate = today;
      await chrome.storage.local.set({ lastResetDate });
    }

    if (!dailyStats[today]) {
      dailyStats[today] = {
        totalPosts: 0,
        shownPosts: 0,
        filteredPosts: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0
      };
      await chrome.storage.local.set({ dailyStats });
    }

    console.log('📊 BACKGROUND DEBUG: Initialized statistics storage for', today);
    console.log('📊 DAILY STATS:', dailyStats[today]);
    console.log('📊 TOTAL STATS:', totalStats);
  } catch (error) {
    console.error('Error initializing statistics storage:', error);
  }
}

async function incrementGlobalApiCounter(postCount = 1) {
  globalApiRequestCount += postCount;
  try {
    await chrome.storage.local.set({ globalApiRequestCount });
    console.log('🔧 BACKGROUND DEBUG: Global API counter incremented by', postCount, 'to:', globalApiRequestCount);
  } catch (error) {
    console.error('Error saving global API counter:', error);
  }
}

async function updateTabTokenUsage(inputTokens, outputTokens, totalCost) {
  try {
    const tabId = await getCurrentTabId();
    if (tabId) {
      const currentUsage = tabTokenUsage.get(tabId) || {
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0
      };

      currentUsage.inputTokens += inputTokens;
      currentUsage.outputTokens += outputTokens;
      currentUsage.totalCost += totalCost;

      tabTokenUsage.set(tabId, currentUsage);
      console.log('💰 BACKGROUND DEBUG: Updated token usage for tab', tabId, ':', currentUsage);

      await updateDailyAndTotalStats({ inputTokens, outputTokens, totalCost });
    }
  } catch (error) {
    console.error('Error updating tab token usage:', error);
  }
}

async function updateDailyAndTotalStats(updates) {
  try {
    const today = new Date().toDateString();

    if (lastResetDate !== today) {
      lastResetDate = today;
      if (!dailyStats[today]) {
        dailyStats[today] = {
          totalPosts: 0,
          shownPosts: 0,
          filteredPosts: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0
        };
      }
      await chrome.storage.local.set({ lastResetDate, dailyStats });
    }

    if (updates.inputTokens !== undefined) {
      dailyStats[today].inputTokens += updates.inputTokens;
      totalStats.inputTokens += updates.inputTokens;
    }
    if (updates.outputTokens !== undefined) {
      dailyStats[today].outputTokens += updates.outputTokens;
      totalStats.outputTokens += updates.outputTokens;
    }
    if (updates.totalCost !== undefined) {
      dailyStats[today].totalCost += updates.totalCost;
      totalStats.totalCost += updates.totalCost;
    }
    if (updates.totalPosts !== undefined) {
      dailyStats[today].totalPosts += updates.totalPosts;
      totalStats.totalPosts += updates.totalPosts;
    }
    if (updates.shownPosts !== undefined) {
      dailyStats[today].shownPosts += updates.shownPosts;
      totalStats.shownPosts += updates.shownPosts;
    }
    if (updates.filteredPosts !== undefined) {
      dailyStats[today].filteredPosts += updates.filteredPosts;
      totalStats.filteredPosts += updates.filteredPosts;
    }

    await chrome.storage.local.set({ dailyStats, totalStats });
    console.log('📊 BACKGROUND DEBUG: Updated daily/total stats:', { daily: dailyStats[today], total: totalStats });
  } catch (error) {
    console.error('Error updating daily/total statistics:', error);
  }
}

async function getCurrentTabId() {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    return tabs[0]?.id;
  } catch (error) {
    console.error('Error getting current tab ID:', error);
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('📨 BACKGROUND DEBUG: Message received:', request);

  if (request.action === 'checkItemTitlesBatch') {
    console.log('🔧 BACKGROUND DEBUG: Handling checkItemTitlesBatch request');
    console.log('🔧 BACKGROUND DEBUG: Batch size:', request.items.length);

    incrementGlobalApiCounter(request.items.length);
    handleBatchItemTitleCheck(request.items, request.topics, sendResponse);

    return true;
  }

  if (request.action === 'filteringStarted') {
    console.log('🚀 BACKGROUND DEBUG: Received filteringStarted message');
    getCurrentTabId().then(tabId => {
      if (tabId) {
        tabFilteringStates.set(tabId, 'processing');
        setBadge('processing', tabId);
      }
    });
    chrome.runtime.sendMessage(request).catch(() => {
    });
    return true;
  }

  if (request.action === 'filteringStopped') {
    console.log('🚀 BACKGROUND DEBUG: Received filteringStopped message');
    getCurrentTabId().then(tabId => {
      if (tabId) {
        tabFilteringStates.set(tabId, 'inactive');
        setBadge('inactive', tabId);
      }
    });
    return true;
  }

  if (request.action === 'filteringComplete') {
    console.log('🚀 BACKGROUND DEBUG: Received filteringComplete message');
    getCurrentTabId().then(tabId => {
      if (tabId) {
        tabFilteringStates.set(tabId, 'active');
        setBadge('active', tabId);
      }
    });
    return true;
  }

  if (request.action === 'contentProcessing') {
    console.log('🚀 BACKGROUND DEBUG: Received contentProcessing message');
    getCurrentTabId().then(tabId => {
      if (tabId) {
        tabFilteringStates.set(tabId, 'processing');
        setBadge('processing', tabId);
      }
    });
    return true;
  }

  if (request.action === 'statsUpdate') {
    console.log('📊 BACKGROUND DEBUG: Received statsUpdate message:', request.statistics);
    (async () => {
      try {
        const tabId = await getCurrentTabId();
        console.log('📊 BACKGROUND DEBUG: Storing stats for tab ID:', tabId);
        if (tabId && request.statistics) {
          const previousStats = tabStatistics.get(tabId) || { totalPosts: 0, shownPosts: 0, filteredPosts: 0 };
          tabStatistics.set(tabId, request.statistics);

          const statsDiff = {
            totalPosts: request.statistics.totalPosts - previousStats.totalPosts,
            shownPosts: request.statistics.shownPosts - previousStats.shownPosts,
            filteredPosts: request.statistics.filteredPosts - previousStats.filteredPosts
          };

          if (statsDiff.totalPosts > 0 || statsDiff.shownPosts > 0 || statsDiff.filteredPosts > 0) {
            await updateDailyAndTotalStats(statsDiff);
          }

          console.log('📊 BACKGROUND DEBUG: Updated tab statistics for tab', tabId, ':', request.statistics);
          chrome.runtime.sendMessage({
            action: 'tabStatsUpdated',
            tabId: tabId,
            statistics: request.statistics
          }).catch(() => {});
        }
      } catch (error) {
        console.error('📊 BACKGROUND DEBUG: Error updating stats:', error);
      }
    })();
    return true;
  }

  if (request.action === 'getGlobalStats') {
    console.log('📊 BACKGROUND DEBUG: Received getGlobalStats message');
    sendResponse({
      globalApiRequestCount: globalApiRequestCount
    });
    return true;
  }

  if (request.action === 'getCurrentTabStats') {
    console.log('📊 BACKGROUND DEBUG: Received getCurrentTabStats message');
    (async () => {
      try {
        const tabId = await getCurrentTabId();
        console.log('📊 BACKGROUND DEBUG: Current tab ID:', tabId);
        const stats = tabStatistics.get(tabId) || {
          totalPosts: 0,
          shownPosts: 0,
          filteredPosts: 0
        };
        const tokenUsage = tabTokenUsage.get(tabId) || {
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0
        };
        console.log('📊 BACKGROUND DEBUG: Sending stats:', stats, 'tokens:', tokenUsage, 'global:', globalApiRequestCount);
        sendResponse({
          statistics: stats,
          tokenUsage: tokenUsage,
          globalApiRequestCount: globalApiRequestCount
        });
      } catch (error) {
        console.log('📊 BACKGROUND DEBUG: Error getting tab stats:', error);
        sendResponse({
          statistics: { totalPosts: 0, shownPosts: 0, filteredPosts: 0 },
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
          globalApiRequestCount: globalApiRequestCount
        });
      }
    })();
    return true;
  }

  if (request.action === 'getTodayStats') {
    console.log('📊 BACKGROUND DEBUG: Received getTodayStats message');
    try {
      const today = new Date().toDateString();
      const todayStats = dailyStats[today] || {
        totalPosts: 0,
        shownPosts: 0,
        filteredPosts: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0
      };
      console.log('📊 BACKGROUND DEBUG: Sending today stats:', todayStats);
      sendResponse(todayStats);
    } catch (error) {
      console.log('📊 BACKGROUND DEBUG: Error getting today stats:', error);
      sendResponse({
        totalPosts: 0,
        shownPosts: 0,
        filteredPosts: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0
      });
    }
    return true;
  }

  if (request.action === 'getTotalStats') {
    console.log('📊 BACKGROUND DEBUG: Received getTotalStats message');
    try {
      console.log('📊 BACKGROUND DEBUG: Sending total stats:', totalStats);
      sendResponse(totalStats);
    } catch (error) {
      console.log('📊 BACKGROUND DEBUG: Error getting total stats:', error);
      sendResponse({
        totalPosts: 0,
        shownPosts: 0,
        filteredPosts: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0
      });
    }
    return true;
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await checkAndUpdateIcon(tab);

  const savedState = tabFilteringStates.get(activeInfo.tabId);
  if (savedState && isSupportedSite(tab.url)) {
    setBadge(savedState, activeInfo.tabId);
  }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await checkAndUpdateIcon(tab);
  }
});

chrome.runtime.onStartup.addListener(() => {
  initializeIcon();
  initializeGlobalApiCounter();
  initializeStatisticsStorage();
});

chrome.runtime.onInstalled.addListener(() => {
  initializeIcon();
  initializeGlobalApiCounter();
  initializeStatisticsStorage();
});

async function initializeIcon() {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
      await checkAndUpdateIcon(tabs[0]);
    } else {
      setBadge('inactive');
    }
  } catch (error) {
    console.error('Error initializing icon:', error);
    setBadge('inactive');
  }
}


async function handleBatchItemTitleCheck(items, topics, sendResponse) {
  console.log('🔧 BACKGROUND DEBUG: Starting handleBatchItemTitleCheck');
  console.log('🔧 BACKGROUND DEBUG: Items count:', items.length);
  console.log('🔧 BACKGROUND DEBUG: Topics:', topics);

  try {
    const apiConfig = await getApiConfiguration();
    console.log('🔧 BACKGROUND DEBUG: Using own API key:', apiConfig.useOwnApiKey);
    console.log('🔧 BACKGROUND DEBUG: API URL:', apiConfig.url);

    if (!apiConfig.url) {
      throw new Error('API URL not configured');
    }

    if (apiConfig.useOwnApiKey && !apiConfig.apiKey) {
      throw new Error('API key is required when using own OpenRouter key');
    }

    if (!topics || topics.length === 0) {
      throw new Error('No topics configured');
    }

    const prompt = PromptTemplates.createBatchPrompt(items, topics);

    console.log('🔧 BACKGROUND DEBUG: Full batch prompt created:');
    console.log('📋 FULL PROMPT:', prompt);
    console.log('🔧 BACKGROUND DEBUG: Making batch API request...');

    const requestBody = {
      model: CONFIG.MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0
    };

    if (!apiConfig.useOwnApiKey) {
      requestBody.postCount = items.length;
    }

    const response = await fetch(apiConfig.url, {
      method: 'POST',
      headers: apiConfig.headers,
      body: JSON.stringify(requestBody)
    });

    console.log('🔧 BACKGROUND DEBUG: Batch API response status:', response.status);
    console.log('🔧 BACKGROUND DEBUG: Batch API response OK:', response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('🔧 BACKGROUND DEBUG: Batch API error response:', errorData);

      if (response.status === 429 && errorData && errorData.error === 'Daily limit exceeded') {
        console.log('🚫 BACKGROUND DEBUG: Daily limit exceeded from proxy server');
        sendResponse({
          error: 'DAILY_LIMIT_EXCEEDED',
          message: errorData.message,
          dailyLimit: errorData.dailyLimit,
          currentUsage: errorData.currentUsage,
          remaining: errorData.remaining,
          resetTime: errorData.resetTime
        });
        return;
      }

      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('🔧 BACKGROUND DEBUG: Batch API response data:', JSON.stringify(data, null, 2));

    if (data.usageInfo && !apiConfig.useOwnApiKey) {
      console.log('📊 BACKGROUND DEBUG: Daily usage info:', data.usageInfo);
      chrome.runtime.sendMessage({
        action: 'dailyUsageUpdate',
        usageInfo: data.usageInfo
      }).catch(() => {});
    }

    if (data.usage) {
      const inputTokens = data.usage.prompt_tokens || 0;
      const outputTokens = data.usage.completion_tokens || 0;
      const totalTokens = data.usage.total_tokens || 0;

      const inputCost = (inputTokens / 1000000) * 0.10;
      const outputCost = (outputTokens / 1000000) * 0.40;
      const totalCost = inputCost + outputCost;

      console.log('💰 BATCH TOKEN USAGE - Input:', inputTokens, 'tokens, Output:', outputTokens, 'tokens, Total:', totalTokens, 'tokens');
      console.log('💰 BATCH COST BREAKDOWN - Input: $' + inputCost.toFixed(6) + ', Output: $' + outputCost.toFixed(6) + ', Total: $' + totalCost.toFixed(6));
      console.log('💰 BATCH COST PER ITEM - $' + (totalCost / items.length).toFixed(6) + ' per item');

      await updateTabTokenUsage(inputTokens, outputTokens, totalCost);
    } else {
      console.log('⚠️ BATCH TOKEN WARNING: No usage data found in API response');
      console.log('⚠️ BATCH RESPONSE KEYS:', Object.keys(data));
    }

    if (data.choices && data.choices[0]) {
      const fullResponse = data.choices[0].message.content.trim();
      console.log('🔧 BACKGROUND DEBUG: Full AI response:', fullResponse);

      const lines = fullResponse.split('\n').filter(line => line.trim() !== '');
      const results = [];

      console.log('🔧 BACKGROUND DEBUG: Parsing response lines:', lines);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let isAllowed = false;

        const expectedNumber = i + 1;
        const responseLine = lines.find(line =>
          line.trim().startsWith(`${expectedNumber}.`) ||
                    line.trim().startsWith(`${expectedNumber}`)
        );

        if (responseLine) {
          const answer = responseLine.toLowerCase();
          isAllowed = answer.includes('yes');
          console.log(`🔧 BACKGROUND DEBUG: Item ${expectedNumber} "${item.title}" -> ${responseLine} -> ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
        } else {
          console.warn(`🔧 BACKGROUND DEBUG: No response found for item ${expectedNumber}, defaulting to BLOCKED`);
        }

        results.push({
          title: item.title,
          isAllowed: isAllowed,
          responseLine: responseLine || 'No response'
        });
      }

      console.log('🔧 BACKGROUND DEBUG: Final batch results:', results);

      sendResponse({
        results: results,
        fullResponse: fullResponse
      });
    } else {
      console.error('🔧 BACKGROUND DEBUG: Invalid batch API response structure:', data);
      throw new Error('Invalid API response: ' + (data.error?.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('🔧 BACKGROUND DEBUG: Error in handleBatchItemTitleCheck:', error);
    sendResponse({ error: error.message });
  }
}

const SUPPORTED_SITES = [
  'youtube.com',
  'news.ycombinator.com',
];

function isSupportedSite(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_SITES.some(site => hostname.includes(site));
  } catch (error) {
    return false;
  }
}

async function checkAndUpdateIcon(tab) {
  if (!tab || !tab.url) return;

  const isSupported = isSupportedSite(tab.url);

  if (!isSupported) {
    setBadge('inactive');
    return;
  }

  setBadge('inactive');
}


function setBadge(state, tabId = null) {
  console.log(`🔧 BACKGROUND DEBUG: Setting badge state to ${state} for tab ${tabId || 'ALL'}`);

  let badgeText = '';
  let badgeColor = '#6c757d';

  switch(state) {
  case 'inactive':
    badgeText = '●';
    badgeColor = '#6c757d';
    break;
  case 'processing':
    badgeText = '●';
    badgeColor = '#ffc107';
    break;
  case 'active':
    badgeText = '●';
    badgeColor = '#28a745';
    break;
  default:
    badgeText = '';
    badgeColor = '#6c757d';
  }

  const badgeConfig = { text: badgeText };
  const badgeColorConfig = { color: badgeColor };

  if (tabId) {
    badgeConfig.tabId = tabId;
    badgeColorConfig.tabId = tabId;
  }

  Promise.all([
    chrome.action.setBadgeText(badgeConfig),
    chrome.action.setBadgeBackgroundColor(badgeColorConfig)
  ]).then(() => {
    console.log(`✅ BACKGROUND DEBUG: Badge set to ${state} (${badgeText}, ${badgeColor}) for tab ${tabId || 'ALL'}`);
  }).catch(error => {
    console.error(`❌ BACKGROUND DEBUG: Error setting badge for tab ${tabId || 'ALL'}:`, error);
  });
}

