// API key loaded from config.js
const OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

document.addEventListener('DOMContentLoaded', function() {
    const factButton = document.getElementById('factButton');

    // Random fact button
    factButton.addEventListener('click', async function() {
        if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === '__OPENROUTER_API_KEY__') {
            alert('Please build the extension first: node build.js');
            return;
        }

        factButton.textContent = 'Loading...';
        factButton.disabled = true;

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash-lite-preview-06-17',
                    messages: [
                        {
                            role: 'user',
                            content: 'Give me one interesting random fact in 1-2 sentences.'
                        }
                    ]
                })
            });

            const data = await response.json();
            
            if (data.choices && data.choices[0]) {
                alert(data.choices[0].message.content);
            } else {
                alert('Error: ' + (data.error?.message || 'Unknown error'));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            factButton.textContent = 'Get Random Fact';
            factButton.disabled = false;
        }
    });
});