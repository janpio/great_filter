class PromptTemplates {
  static createBatchPrompt(items, topics) {
    const topicsString = topics.join(', ');

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
}

if (typeof window !== 'undefined') {
  window.PromptTemplates = PromptTemplates;
} else {
  globalThis.PromptTemplates = PromptTemplates;
}
