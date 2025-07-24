class PromptTemplates {
  static createBatchPrompt(items, topics) {
    const topicsString = topics.join(', ');

    let prompt = `User preferences: ${topicsString}. For each content excerpts, indicate whether it satisfies the user preferences.

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

if (typeof window !== 'undefined') {
  window.PromptTemplates = PromptTemplates;
} else {
  globalThis.PromptTemplates = PromptTemplates;
}
