console.log('🔍 Smart Content Filter: Content script loaded');

const processedVideos = new Set();

function extractVideoElements() {
    console.log('🔍 DEBUG: Starting extractVideoElements()');
    const videoElements = [];
    
    const containerSelectors = [
        'ytd-rich-grid-media',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-rich-item-renderer',
        'ytd-grid-video-renderer',
        'ytd-playlist-video-renderer',
        'ytd-movie-renderer'
    ];
    
    console.log('🔍 DEBUG: Container selectors:', containerSelectors);
    
    containerSelectors.forEach((selector, index) => {
        console.log(`🔍 DEBUG: Checking selector ${index + 1}: ${selector}`);
        const containers = document.querySelectorAll(selector);
        console.log(`🔍 DEBUG: Found ${containers.length} containers for selector: ${selector}`);
        
        containers.forEach((container, containerIndex) => {
            console.log(`🔍 DEBUG: Processing container ${containerIndex + 1} for selector: ${selector}`);
            
            const titleSelectors = [
                'yt-formatted-string#video-title',
                'a#video-title-link',
                'h3 a',
                'span[title]',
                'a[title]'
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
                let title = titleElement.textContent?.trim() || titleElement.title?.trim() || titleElement.getAttribute('title')?.trim();
                
                console.log(`🔍 DEBUG: Extracted title: "${title}" (selector: ${usedSelector})`);
                
                if (title && !processedVideos.has(title)) {
                    console.log(`🔍 DEBUG: Adding new video: "${title}"`);
                    videoElements.push({
                        title: title,
                        container: container,
                        titleElement: titleElement,
                        usedSelector: usedSelector
                    });
                } else if (title && processedVideos.has(title)) {
                    console.log(`🔍 DEBUG: Skipping already processed video: "${title}"`);
                } else {
                    console.log(`🔍 DEBUG: No title found for container`);
                }
            } else {
                console.log(`🔍 DEBUG: No title element found in container`);
            }
        });
    });
    
    console.log(`🔍 DEBUG: Total video elements found: ${videoElements.length}`);
    return videoElements;
}

function blurVideo(container, title) {
    console.log(`🔥 DEBUG: Applying blur and B&W to video: "${title}"`);
    if (!container.style.filter) {
        container.style.filter = 'blur(5px) grayscale(100%)';
        container.style.opacity = '0.6';
        container.style.pointerEvents = 'none';
        container.title = `Filtered: ${title}`;
        console.log('✅ Smart Content Filter: Blurred and desaturated video:', title);
    } else {
        console.log('⚠️ DEBUG: Video already filtered:', title);
    }
}

function unblurVideo(container) {
    console.log(`🔥 DEBUG: Removing blur from video and adding pink outline`);
    container.style.filter = '';
    container.style.opacity = '';
    container.style.pointerEvents = '';
    container.style.setProperty('outline', '3px solid #ff69b4', 'important');
    container.style.setProperty('outline-offset', '1px', 'important');
    container.title = 'Allowed: Video kept';
}

async function processVideosForFiltering(topics) {
    console.log('🚀 DEBUG: Starting processVideosForFiltering()');
    console.log('🚀 DEBUG: Topics provided:', topics);
    
    try {
        const videoElements = extractVideoElements();
        
        if (videoElements.length === 0) {
            console.log('❌ Smart Content Filter: No new videos found');
            return;
        }
        
        console.log(`🚀 Smart Content Filter: Processing ${videoElements.length} videos in single batch`);
        
        videoElements.forEach(video => processedVideos.add(video.title));
        
        console.log(`📡 DEBUG: Sending batch of ${videoElements.length} videos to background script`);
        
        const response = await chrome.runtime.sendMessage({
            action: 'checkVideoTitlesBatch',
            videos: videoElements.map((video, index) => ({
                index: index + 1,
                title: video.title,
                container: video.container
            })),
            topics: topics
        });
        
        console.log(`📡 DEBUG: Batch response received:`, response);
        
        if (response.error) {
            console.error('❌ Smart Content Filter: Error checking videos:', response.error);
            return;
        }
        
        console.log('🎯 DEBUG: Applying batch results to videos');
        response.results.forEach((result, index) => {
            const video = videoElements[index];
            if (result.isAllowed) {
                unblurVideo(video.container);
                console.log(`✅ Smart Content Filter: Video ${index + 1} allowed: "${video.title}"`);
            } else {
                blurVideo(video.container, video.title);
                console.log(`🚫 Smart Content Filter: Video ${index + 1} blocked: "${video.title}"`);
            }
        });
        
        console.log('🎉 DEBUG: Finished processing all videos in batch');
    } catch (error) {
        console.error('❌ Smart Content Filter: Error in processVideosForFiltering:', error);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 DEBUG: Message received in content script:', request);
    
    if (request.action === 'startFiltering') {
        console.log('🚀 DEBUG: Starting filtering with topics:', request.topics);
        processVideosForFiltering(request.topics);
        startScrollMonitoring(request.topics);
        sendResponse({ success: true });
    }
    
    return true;
});

console.log('🔍 DEBUG: Initial video element check...');
extractVideoElements();

let scrollTimeout;
let isScrollProcessing = false;
let currentTopics = null;

function handleScroll() {
    if (!currentTopics || isScrollProcessing) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(async () => {
        console.log('📜 DEBUG: Scroll detected, checking for new videos');
        
        const allVideos = extractVideoElements();
        const newVideos = allVideos.filter(video => !processedVideos.has(video.title));
        
        if (newVideos.length > 0) {
            console.log(`📜 DEBUG: Found ${newVideos.length} new videos on scroll`);
            isScrollProcessing = true;
            
            try {
                console.log(`📡 DEBUG: Sending batch of ${newVideos.length} new videos to background script`);
                
                const response = await chrome.runtime.sendMessage({
                    action: 'checkVideoTitlesBatch',
                    videos: newVideos.map((video, index) => ({
                        index: index + 1,
                        title: video.title,
                        container: video.container
                    })),
                    topics: currentTopics
                });
                
                console.log(`📡 DEBUG: Scroll batch response received:`, response);
                
                if (response.error) {
                    console.error('❌ Smart Content Filter: Error checking scroll videos:', response.error);
                    return;
                }
                
                console.log('🎯 DEBUG: Applying scroll batch results to videos');
                response.results.forEach((result, index) => {
                    const video = newVideos[index];
                    processedVideos.add(video.title);
                    
                    if (result.isAllowed) {
                        unblurVideo(video.container);
                        console.log(`✅ Smart Content Filter: Scroll video ${index + 1} allowed: "${video.title}"`);
                    } else {
                        blurVideo(video.container, video.title);
                        console.log(`🚫 Smart Content Filter: Scroll video ${index + 1} blocked: "${video.title}"`);
                    }
                });
                
                console.log('🎉 DEBUG: Finished processing scroll videos in batch');
            } catch (error) {
                console.error('❌ Smart Content Filter: Error processing scroll videos:', error);
            } finally {
                isScrollProcessing = false;
            }
        }
    }, 1000);
}

function startScrollMonitoring(topics) {
    currentTopics = topics;
    window.addEventListener('scroll', handleScroll);
    console.log('📜 DEBUG: Scroll monitoring started');
}

function stopScrollMonitoring() {
    currentTopics = null;
    window.removeEventListener('scroll', handleScroll);
    console.log('📜 DEBUG: Scroll monitoring stopped');
}

console.log('🔍 Smart Content Filter: Ready for manual filtering with scroll support. Use the popup to start!');