const OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

document.addEventListener('DOMContentLoaded', function() {
    const topicsTextarea = document.getElementById('topics');
    const saveButton = document.getElementById('saveButton');
    const savedMessage = document.getElementById('savedMessage');
    const filterButton = document.getElementById('filterButton');
    const filterMessage = document.getElementById('filterMessage');
    const toggleTopics = document.getElementById('toggleTopics');
    const topicsSection = document.getElementById('topicsSection');
    
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const statusDetails = document.getElementById('statusDetails');
    const currentTopics = document.getElementById('currentTopics');
    const stats = document.getElementById('stats');
    const shownCount = document.getElementById('shownCount');
    const filteredCount = document.getElementById('filteredCount');
    const totalCount = document.getElementById('totalCount');
    
    let isFiltering = false;
    let currentStats = { shown: 0, filtered: 0, total: 0 };
    
    loadSavedTopics();
    checkCurrentFilteringState();
    
    toggleTopics.addEventListener('click', function() {
        topicsSection.classList.toggle('visible');
        toggleTopics.textContent = topicsSection.classList.contains('visible') ? 'Hide Topics' : 'Manage Topics';
    });
    
    filterButton.addEventListener('click', async function() {
        if (isFiltering) {
            stopFiltering();
            return;
        }
        
        const result = await chrome.storage.local.get(['allowedTopics']);
        const topics = result.allowedTopics || [];
        
        if (topics.length === 0) {
            alert('Please configure topics first');
            topicsSection.classList.add('visible');
            toggleTopics.textContent = 'Hide Topics';
            return;
        }

        try {
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs[0]) {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'startFiltering',
                    topics: topics
                });
                
                startFiltering(topics);
                
                filterMessage.textContent = 'Filtering started!';
                filterMessage.style.display = 'block';
                setTimeout(() => {
                    filterMessage.style.display = 'none';
                }, 3000);
            }
        } catch (error) {
            console.error('Error starting filter:', error);
            alert('Error starting filter. Make sure you are on a supported website: ' + error.message);
        }
    });

    saveButton.addEventListener('click', async function() {
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
            
            savedMessage.style.display = 'block';
            setTimeout(() => {
                savedMessage.style.display = 'none';
            }, 3000);
            
            updateStatus();
            
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
                topicsTextarea.value = result.allowedTopics.join('\n');
            }
            updateStatus();
        } catch (error) {
            console.error('Error loading topics:', error);
            setStatus('inactive', 'Error loading settings');
        }
    }

    async function checkCurrentFilteringState() {
        try {
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs[0]) {
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'getFilteringState'
                });
                
                if (response && response.isActive) {
                    console.log('Filtering is already active, syncing popup state');
                    isFiltering = true;
                    currentStats = response.stats || { shown: 0, filtered: 0, total: 0 };
                    startFiltering(response.topics || [], true);
                } else {
                    updateStatus();
                }
            } else {
                updateStatus();
            }
        } catch (error) {
            console.log('Could not check filtering state (probably not on supported site):', error);
            updateStatus();
        }
    }

    async function updateStatus() {
        try {
            const result = await chrome.storage.local.get(['allowedTopics']);
            const topics = result.allowedTopics || [];
            
            if (topics.length > 0) {
                setStatus('inactive', 'Ready to filter', `${topics.length} topic${topics.length > 1 ? 's' : ''} configured`, topics);
            } else {
                setStatus('inactive', 'No topics configured', 'Click "Manage Topics" to get started');
            }
        } catch (error) {
            console.error('Error checking status:', error);
            setStatus('inactive', 'Error checking status');
        }
    }
    
    function startFiltering(topics, skipStatsReset = false) {
        isFiltering = true;
        filterButton.textContent = 'Stop Filtering';
        filterButton.style.backgroundColor = '#dc3545';
        setStatus('running', 'Filtering active', 'Processing videos...', topics);
        stats.style.display = 'flex';
        
        if (!skipStatsReset) {
            currentStats = { shown: 0, filtered: 0, total: 0 };
        }
        updateStatsDisplay();
        
        startStatsPolling();
    }
    
    async function stopFiltering() {
        isFiltering = false;
        filterButton.textContent = 'Start Filtering';
        filterButton.style.backgroundColor = '#2196F3';
        
        try {
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs[0]) {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'stopFiltering'
                });
            }
        } catch (error) {
            console.error('Error stopping filter:', error);
        }
        
        const result = await chrome.storage.local.get(['allowedTopics']);
        const topics = result.allowedTopics || [];
        setStatus('inactive', 'Filtering stopped', 'Refresh page to see all content', topics);
        stats.style.display = 'none';
        stopStatsPolling();
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
    
    function updateStatsDisplay() {
        shownCount.textContent = currentStats.shown;
        filteredCount.textContent = currentStats.filtered;
        totalCount.textContent = currentStats.total;
    }
    
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'updateStats') {
            currentStats = request.stats;
            updateStatsDisplay();
            
            if (isFiltering && currentStats.total > 0) {
                setStatus('running', 'Filtering active', `${currentStats.total} videos processed`);
            }
        }
        
        if (request.action === 'filteringStarted') {
            console.log('Auto-filtering started with topics:', request.topics);
            startFiltering(request.topics);
        }
    });
    
    function startStatsPolling() {
        currentStats = { shown: 0, filtered: 0, total: 0 };
        updateStatsDisplay();
    }
    
    function stopStatsPolling() {
    }
});