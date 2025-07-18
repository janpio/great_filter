console.log('🔍 Smart Content Filter: Reddit content script loaded');

const processedPosts = new Set();

function extractRedditPosts() {
    console.log('🔍 DEBUG: Starting extractRedditPosts()');
    const postElements = [];
    
    const postContainers = document.querySelectorAll('shreddit-post');
    console.log(`🔍 DEBUG: Found ${postContainers.length} Reddit posts`);
    
    postContainers.forEach((container, index) => {
        console.log(`🔍 DEBUG: Processing post ${index + 1}`);
        
        const title = container.getAttribute('post-title');
        
        if (title && !processedPosts.has(title)) {
            console.log(`🔍 DEBUG: Adding new post: "${title}"`);
            postElements.push({
                title: title,
                container: container
            });
        } else if (title && processedPosts.has(title)) {
            console.log(`🔍 DEBUG: Skipping already processed post: "${title}"`);
        } else {
            console.log(`🔍 DEBUG: No title found for post container`);
        }
    });
    
    console.log(`🔍 DEBUG: Total Reddit posts found: ${postElements.length}`);
    return postElements;
}

function blurPost(container, title) {
    console.log(`🔥 DEBUG: Applying blur and B&W to Reddit post: "${title}"`);
    if (!container.style.filter) {
        container.style.filter = 'blur(5px) grayscale(100%)';
        container.style.opacity = '0.6';
        container.style.pointerEvents = 'none';
        container.title = `Filtered: ${title}`;
        console.log('✅ Smart Content Filter: Blurred and desaturated Reddit post:', title);
    } else {
        console.log('⚠️ DEBUG: Post already filtered:', title);
    }
}

function unblurPost(container) {
    console.log(`🔥 DEBUG: Removing blur from Reddit post and adding pink outline`);
    container.style.filter = '';
    container.style.opacity = '';
    container.style.pointerEvents = '';
    container.style.setProperty('outline', '3px solid #ff69b4', 'important');
    container.style.setProperty('outline-offset', '1px', 'important');
    container.title = 'Allowed: Post kept';
}

async function processRedditPostsForFiltering(topics) {
    console.log('🚀 DEBUG: Starting processRedditPostsForFiltering()');
    console.log('🚀 DEBUG: Topics provided:', topics);
    
    try {
        const postElements = extractRedditPosts();
        
        if (postElements.length === 0) {
            console.log('❌ Smart Content Filter: No new Reddit posts found');
            return;
        }
        
        console.log(`🚀 Smart Content Filter: Processing ${postElements.length} Reddit posts in single batch`);
        
        postElements.forEach(post => processedPosts.add(post.title));
        
        console.log(`📡 DEBUG: Sending batch of ${postElements.length} Reddit posts to background script`);
        
        const response = await chrome.runtime.sendMessage({
            action: 'checkVideoTitlesBatch',
            videos: postElements.map((post, index) => ({
                index: index + 1,
                title: post.title,
                container: post.container
            })),
            topics: topics
        });
        
        console.log(`📡 DEBUG: Batch response received:`, response);
        
        if (response.error) {
            console.error('❌ Smart Content Filter: Error checking Reddit posts:', response.error);
            return;
        }
        
        console.log('🎯 DEBUG: Applying batch results to Reddit posts');
        response.results.forEach((result, index) => {
            const post = postElements[index];
            if (result.isAllowed) {
                unblurPost(post.container);
                console.log(`✅ Smart Content Filter: Reddit post ${index + 1} allowed: "${post.title}"`);
            } else {
                blurPost(post.container, post.title);
                console.log(`🚫 Smart Content Filter: Reddit post ${index + 1} blocked: "${post.title}"`);
            }
        });
        
        console.log('🎉 DEBUG: Finished processing all Reddit posts in batch');
    } catch (error) {
        console.error('❌ Smart Content Filter: Error in processRedditPostsForFiltering:', error);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 DEBUG: Message received in Reddit content script:', request);
    
    if (request.action === 'startFiltering') {
        console.log('🚀 DEBUG: Starting Reddit filtering with topics:', request.topics);
        processRedditPostsForFiltering(request.topics);
        startScrollMonitoring(request.topics);
        sendResponse({ success: true });
    }
    
    return true;
});

console.log('🔍 DEBUG: Initial Reddit post element check...');
extractRedditPosts();

let scrollTimeout;
let isScrollProcessing = false;
let currentTopics = null;

function handleScroll() {
    if (!currentTopics || isScrollProcessing) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(async () => {
        console.log('📜 DEBUG: Scroll detected, checking for new Reddit posts');
        
        const allPosts = extractRedditPosts();
        const newPosts = allPosts.filter(post => !processedPosts.has(post.title));
        
        if (newPosts.length > 0) {
            console.log(`📜 DEBUG: Found ${newPosts.length} new Reddit posts on scroll`);
            isScrollProcessing = true;
            
            try {
                console.log(`📡 DEBUG: Sending batch of ${newPosts.length} new Reddit posts to background script`);
                
                const response = await chrome.runtime.sendMessage({
                    action: 'checkVideoTitlesBatch',
                    videos: newPosts.map((post, index) => ({
                        index: index + 1,
                        title: post.title,
                        container: post.container
                    })),
                    topics: currentTopics
                });
                
                console.log(`📡 DEBUG: Scroll batch response received:`, response);
                
                if (response.error) {
                    console.error('❌ Smart Content Filter: Error checking scroll Reddit posts:', response.error);
                    return;
                }
                
                console.log('🎯 DEBUG: Applying scroll batch results to Reddit posts');
                response.results.forEach((result, index) => {
                    const post = newPosts[index];
                    processedPosts.add(post.title);
                    
                    if (result.isAllowed) {
                        unblurPost(post.container);
                        console.log(`✅ Smart Content Filter: Scroll Reddit post ${index + 1} allowed: "${post.title}"`);
                    } else {
                        blurPost(post.container, post.title);
                        console.log(`🚫 Smart Content Filter: Scroll Reddit post ${index + 1} blocked: "${post.title}"`);
                    }
                });
                
                console.log('🎉 DEBUG: Finished processing scroll Reddit posts in batch');
            } catch (error) {
                console.error('❌ Smart Content Filter: Error processing scroll Reddit posts:', error);
            } finally {
                isScrollProcessing = false;
            }
        }
    }, 1000);
}

function startScrollMonitoring(topics) {
    currentTopics = topics;
    window.addEventListener('scroll', handleScroll);
    console.log('📜 DEBUG: Reddit scroll monitoring started');
}

function stopScrollMonitoring() {
    currentTopics = null;
    window.removeEventListener('scroll', handleScroll);
    console.log('📜 DEBUG: Reddit scroll monitoring stopped');
}

console.log('🔍 Smart Content Filter: Ready for Reddit filtering with scroll support. Use the popup to start!');