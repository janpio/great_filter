console.log('🔧 Great Filter: Shared prompts loaded');

class PromptTemplates {
    static createSingleItemPrompt(content, topics) {
        const topicsString = topics.join(', ');
        return `Does this content relate to any of these topics: ${topicsString}?

Content: "${content}"

Answer with only "Yes" or "No".`;
    }

    static createBatchPrompt(items, topics) {
        const topicsString = topics.join(', ');
        
        let prompt = `Does each of these pieces of content relate to any of these topics: ${topicsString}?

Please answer with only numbered responses in the format:
1. YES
2. NO
3. YES
etc.

Content:
`;

        items.forEach((item, index) => {
            prompt += `${index + 1}. "${item.title}"\n`;
        });

        return prompt;
    }
}

window.PromptTemplates = PromptTemplates;