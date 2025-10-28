class PromptTemplates {
  static createBatchPrompt(items, topics, sendImages = false) {
    const topicsString = topics.join(', ');
    const hasImages = sendImages && items.some(item => item.imageUrls && item.imageUrls.length > 0);

    if (hasImages) {
      return this.createVisionBatchPrompt(items, topics);
    }

    let prompt = `For each content excerpt, determine if it should be shown (YES) to the user based on their preferences.

DECISION RULES:
- DEFAULT: Show content (YES) unless it matches a blocked topic/preference
- If preferences say "block X", "hide X", "not X", "no X" → content about X gets NO, YES otherwise
- If preferences say "show X", "include X", "only X" → content about X gets YES, others get NO

Please answer with only numbered responses in the format:
1. → YES
2. → NO
3. → YES
etc.

---
USER FILTERING PREFERENCES: ${topicsString}
---
Content:
`;

    items.forEach((item, index) => {
      prompt += `${index + 1}. "${item.title}"\n`;
    });

    return prompt;
  }

  static createVisionBatchPrompt(items, topics) {
    const topicsString = topics.join(', ');

    const content = [{
      type: "text",
      text: `For each content item (text and/or images), determine if it should be shown (YES) to the user based on their preferences.

DECISION RULES:
- DEFAULT: Show content (YES) unless it matches a blocked topic/preference
- If preferences say "block X", "hide X", "not X", "no X" → content about X gets NO, YES otherwise
- If preferences say "show X", "include X", "only X" → content about X gets YES, others get NO
- Consider BOTH the text and images when making decisions

Please answer with only numbered responses in the format:
1. → YES
2. → NO
3. → YES
etc.

---
USER FILTERING PREFERENCES: ${topicsString}
---
Content:
`
    }];

    items.forEach((item, index) => {
      content.push({
        type: "text",
        text: `\n${index + 1}. "${item.title}"`
      });

      if (item.imageUrls && item.imageUrls.length > 0) {
        item.imageUrls.forEach(imageUrl => {
          content.push({
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          });
        });
      }
    });

    return content;
  }

  static createRecommendationPrompt(items) {
    let prompt = `Analyze the following content titles and suggest ONE filtering topic that would be most useful.

Requirements:
- Suggest a topic that appears frequently enough to be worth filtering
- Format as either "Show only X" or "Block X" depending on what makes sense
- Be specific and actionable (e.g., "Block Taylor Swift content", "Show only programming tutorials", "Show only music")
- Only suggest filters you are confident can work with good accuracy
- Always provide a suggestion - find the best pattern even if content is diverse

Content titles:
`;

    items.forEach((item, index) => {
      prompt += `${index + 1}. "${item.title}"\n`;
    });

    prompt += `\nReturn ONLY the suggested filter topic as a single line.`;

    return prompt;
  }
}

if (typeof window !== 'undefined') {
  window.PromptTemplates = PromptTemplates;
} else {
  globalThis.PromptTemplates = PromptTemplates;
}
