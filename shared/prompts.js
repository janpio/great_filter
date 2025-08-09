class PromptTemplates {
  static createBatchPrompt(items, topics) {
    const topicsString = topics.join(', ');

    let prompt = `User preferences: ${topicsString}

For each content excerpt, determine if it should be SHOWN to the user based on their preferences.

STRICT FILTERING RULES:
- If content is empty, contains only generic text, or lacks meaningful information → NO
- If content is clearly spam, promotional, or low-quality → NO
- If content does NOT clearly match the user's specified interests → NO
- Only say YES if the content genuinely aligns with their preferences and has substance

Be conservative: when in doubt, filter it out (say NO).

Please answer with only numbered responses in the format:
1. "GPT-5 Release Date" → YES
2. "Generic clickbait title" → NO
3. "Python Tutorial" → YES
etc.

Content:
`;

    items.forEach((item, index) => {
      prompt += `${index + 1}. "${item.title}"\n`;
    });

    return prompt;
  }
}

if (typeof window !== 'undefined') {
  window.PromptTemplates = PromptTemplates;
} else {
  globalThis.PromptTemplates = PromptTemplates;
}
