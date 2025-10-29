# Great Filter

AI-powered content filtering for social media platforms.

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/great-filter/mbifgfgfbnemojmfkckodkikibihcgaj)

## Development

Clone the repository and load as unpacked extension in Chrome:

```bash
git clone <repo-url>
cd great_filter
# Load unpacked extension from chrome://extensions/
```

## Privacy

See [PRIVACY.md](PRIVACY.md) for privacy policy.

## License
GPL-3.0 - see [LICENSE](LICENSE.md) for details.

## Testing

### End-to-End Tests

Comprehensive Playwright smoke tests validate the extension against all supported sites using local HTML fixtures and mocked API responses.

```bash
npm install
npx playwright install
npm run test:e2e
```

The suite launches Chromium with the unpacked extension, exercises site-specific content scripts (YouTube, Hacker News, Reddit, X), verifies filtering states, and checks recommendation flows. Test results and traces are written to `playwright-report/` and `test-results/`.

To run the same smoke suite against the live websites instead of fixtures (still using mocked LLM responses), use:

```bash
npm run test:smoke
```

This sets `GF_USE_LIVE=1`, disables the local HTML fixtures, and drives the extension against real pages (YouTube search results, Reddit homepage, a public X profile, Hacker News front page) so selectors and DOM interactions are validated against current production markup.

Need to inspect the run afterward? Capture full Playwright traces and replay them later:

```bash
npm run test:smoke:trace
# open the latest trace
npx playwright show-trace test-results/<test-name>/trace.zip
```

The trace viewer lets you scrub through each command, inspect DOM snapshots, and see the final page state without keeping the browser open.
