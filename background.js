console.log('🔧 Smart Content Filter: Background worker loaded');

importScripts('config.js');

let lastApiCall = 0;
const MIN_API_INTERVAL = 100;
let apiCallQueue = [];
let processingQueue = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 BACKGROUND DEBUG: Message received:', request);
    
    if (request.action === 'checkVideoTitle') {
        console.log('🔧 BACKGROUND DEBUG: Handling checkVideoTitle request');
        
        apiCallQueue.push({
            title: request.title,
            topics: request.topics,
            sendResponse: sendResponse
        });
        
        if (!processingQueue) {
            processApiQueue();
        }
        
        return true;
    }
    
    if (request.action === 'checkVideoTitlesBatch') {
        console.log('🔧 BACKGROUND DEBUG: Handling checkVideoTitlesBatch request');
        console.log('🔧 BACKGROUND DEBUG: Batch size:', request.videos.length);
        
        handleBatchVideoTitleCheck(request.videos, request.topics, sendResponse);
        
        return true;
    }
});

async function processApiQueue() {
    processingQueue = true;
    console.log('🔧 BACKGROUND DEBUG: Processing API queue, items:', apiCallQueue.length);
    
    while (apiCallQueue.length > 0) {
        const { title, topics, sendResponse } = apiCallQueue.shift();
        
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCall;
        
        if (timeSinceLastCall < MIN_API_INTERVAL) {
            const delay = MIN_API_INTERVAL - timeSinceLastCall;
            console.log(`🔧 BACKGROUND DEBUG: Rate limiting - waiting ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        try {
            lastApiCall = Date.now();
            const result = await handleVideoTitleCheck(title, topics);
            console.log('🔧 BACKGROUND DEBUG: Sending response:', result);
            sendResponse(result);
        } catch (error) {
            console.error('🔧 BACKGROUND DEBUG: Error occurred:', error);
            sendResponse({ error: error.message });
        }
    }
    
    processingQueue = false;
    console.log('🔧 BACKGROUND DEBUG: Finished processing API queue');
}

async function handleVideoTitleCheck(title, topics) {
    console.log('🔧 BACKGROUND DEBUG: Starting handleVideoTitleCheck');
    console.log('🔧 BACKGROUND DEBUG: Title:', title);
    console.log('🔧 BACKGROUND DEBUG: Topics:', topics);
    
    try {
        console.log('🔧 BACKGROUND DEBUG: Checking API key...');
        if (!CONFIG.OPENROUTER_API_KEY || CONFIG.OPENROUTER_API_KEY === '__OPENROUTER_API_KEY__') {
            throw new Error('OpenRouter API key not configured');
        }
        console.log('🔧 BACKGROUND DEBUG: API key check passed');

        if (!topics || topics.length === 0) {
            throw new Error('No topics configured');
        }

        const topicsString = topics.join(', ');
        const prompt = `Does this video title relate to any of these topics: ${topicsString}?

Video title: "${title}"

Answer with only "Yes" or "No".`;

        console.log('🔧 BACKGROUND DEBUG: Prompt created:', prompt);
        console.log('🔧 BACKGROUND DEBUG: Making API request...');

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite-preview-06-17',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 10,
                temperature: 0
            })
        });

        console.log('🔧 BACKGROUND DEBUG: API response status:', response.status);
        console.log('🔧 BACKGROUND DEBUG: API response OK:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('🔧 BACKGROUND DEBUG: API error response:', errorText);
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('🔧 BACKGROUND DEBUG: API response data:', JSON.stringify(data, null, 2));
        
        if (data.choices && data.choices[0]) {
            const answer = data.choices[0].message.content.trim().toLowerCase();
            const isAllowed = answer.includes('yes');
            
            console.log('🔧 BACKGROUND DEBUG: API answer:', answer);
            console.log('🔧 BACKGROUND DEBUG: Video allowed:', isAllowed);
            
            return {
                title: title,
                isAllowed: isAllowed,
                apiResponse: answer
            };
        } else {
            console.error('🔧 BACKGROUND DEBUG: Invalid API response structure:', data);
            throw new Error('Invalid API response: ' + (data.error?.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('🔧 BACKGROUND DEBUG: Error in handleVideoTitleCheck:', error);
        throw error;
    }
}

async function handleBatchVideoTitleCheck(videos, topics, sendResponse) {
    console.log('🔧 BACKGROUND DEBUG: Starting handleBatchVideoTitleCheck');
    console.log('🔧 BACKGROUND DEBUG: Videos count:', videos.length);
    console.log('🔧 BACKGROUND DEBUG: Topics:', topics);
    
    try {
        console.log('🔧 BACKGROUND DEBUG: Checking API key...');
        if (!CONFIG.OPENROUTER_API_KEY || CONFIG.OPENROUTER_API_KEY === '__OPENROUTER_API_KEY__') {
            throw new Error('OpenRouter API key not configured');
        }
        console.log('🔧 BACKGROUND DEBUG: API key check passed');

        if (!topics || topics.length === 0) {
            throw new Error('No topics configured');
        }

        const topicsString = topics.join(', ');
        
        let prompt = `Does each of these video titles relate to any of these topics: ${topicsString}?

Please answer with only numbered responses in the format:
1. YES
2. NO
3. YES
etc.

Video titles:
`;

        videos.forEach((video, index) => {
            prompt += `${index + 1}. "${video.title}"\n`;
        });

        console.log('🔧 BACKGROUND DEBUG: Full batch prompt created:');
        console.log('📋 FULL PROMPT:', prompt);
        console.log('🔧 BACKGROUND DEBUG: Making batch API request...');

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite-preview-06-17',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0
            })
        });

        console.log('🔧 BACKGROUND DEBUG: Batch API response status:', response.status);
        console.log('🔧 BACKGROUND DEBUG: Batch API response OK:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('🔧 BACKGROUND DEBUG: Batch API error response:', errorText);
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('🔧 BACKGROUND DEBUG: Batch API response data:', JSON.stringify(data, null, 2));
        
        if (data.choices && data.choices[0]) {
            const fullResponse = data.choices[0].message.content.trim();
            console.log('🔧 BACKGROUND DEBUG: Full AI response:', fullResponse);
            
            const lines = fullResponse.split('\n').filter(line => line.trim() !== '');
            const results = [];
            
            console.log('🔧 BACKGROUND DEBUG: Parsing response lines:', lines);
            
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                let isAllowed = false;
                
                const expectedNumber = i + 1;
                const responseLine = lines.find(line => 
                    line.trim().startsWith(`${expectedNumber}.`) || 
                    line.trim().startsWith(`${expectedNumber}`)
                );
                
                if (responseLine) {
                    const answer = responseLine.toLowerCase();
                    isAllowed = answer.includes('yes');
                    console.log(`🔧 BACKGROUND DEBUG: Video ${expectedNumber} "${video.title}" -> ${responseLine} -> ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
                } else {
                    console.warn(`🔧 BACKGROUND DEBUG: No response found for video ${expectedNumber}, defaulting to BLOCKED`);
                }
                
                results.push({
                    title: video.title,
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
        console.error('🔧 BACKGROUND DEBUG: Error in handleBatchVideoTitleCheck:', error);
        sendResponse({ error: error.message });
    }
}