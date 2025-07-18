const OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

document.addEventListener('DOMContentLoaded', function() {
    const topicsTextarea = document.getElementById('topics');
    const saveButton = document.getElementById('saveButton');
    const savedMessage = document.getElementById('savedMessage');
    const statusDiv = document.getElementById('status');
    const filterButton = document.getElementById('filterButton');
    const filterMessage = document.getElementById('filterMessage');

    loadSavedTopics();

    filterButton.addEventListener('click', async function() {
        const topicsText = topicsTextarea.value.trim();
        const topics = topicsText.split('\n').filter(topic => topic.trim() !== '').map(topic => topic.trim());
        
        if (topics.length === 0) {
            alert('Please enter at least one topic before filtering');
            return;
        }

        try {
            await chrome.storage.local.set({ allowedTopics: topics });
            
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});
            if (tabs[0]) {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'startFiltering',
                    topics: topics
                });
                
                filterMessage.style.display = 'block';
                setTimeout(() => {
                    filterMessage.style.display = 'none';
                }, 5000);
            }
        } catch (error) {
            console.error('Error starting filter:', error);
            alert('Error starting filter. Make sure you are on YouTube: ' + error.message);
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
            statusDiv.textContent = 'Error loading settings';
            statusDiv.className = 'status inactive';
        }
    }

    async function updateStatus() {
        try {
            const result = await chrome.storage.local.get(['allowedTopics']);
            const topics = result.allowedTopics || [];
            
            if (topics.length > 0) {
                statusDiv.textContent = `Filter active with ${topics.length} topic${topics.length > 1 ? 's' : ''}`;
                statusDiv.className = 'status active';
            } else {
                statusDiv.textContent = 'No topics configured - filter inactive';
                statusDiv.className = 'status inactive';
            }
        } catch (error) {
            console.error('Error checking status:', error);
            statusDiv.textContent = 'Error checking status';
            statusDiv.className = 'status inactive';
        }
    }
});