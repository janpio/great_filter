# Class Hierarchy: All Content Filters

## Class Structure

```
ContentFilterBase (shared/content-base.js)
    ↓ extends
    ├── XContentFilter (content-scripts/x.js)
    ├── YouTubeContentFilter (content-scripts/youtube.js)
    ├── HackerNewsContentFilter (content-scripts/hackernews.js)
    └── RedditContentFilter (content-scripts/reddit.js)
```

---

## Methods Overview by Class

### BASE CLASS (ContentFilterBase)

**Available to all content scripts:**

- `blurWaitingElement(container, title)` - Apply waiting visual state
- `blurBlockedElement(container, title)` - Apply blocked visual state
- `unblurElement(container)` - Remove visual effects (allowed)
- `processElements(elements, topics)` - Sends batch to API and applies visual effects
- `startScrollMonitoring(topics, extractElementsFunction)` - Sets up polling
- `stopScrollMonitoring()` - Stops polling
- `stopFiltering()` - Stops all filtering
- `waitForElements(extractElementsFunction, callback, ...)` - Waits for initial elements
- `updateScrollActivity()` - Tracks scroll events
- `adjustPollingInterval()` - Adjusts polling speed
- `pollForNewContent()` - Called repeatedly during scroll monitoring
- `processInitialElements(topics)` - Processes initial page load elements
- `checkFilteringState()` - Checks if filtering enabled and starts if needed
- `setupMessageListener()` - Listens for popup messages
- `showDailyLimitMessage(errorResponse)` - Shows daily limit UI
- `getRecommendedFilter()` - Gets AI recommendations

---

### XContentFilter (X/Twitter)

**Site-specific methods:**
- `extractItemElements()` - Finds tweet containers and extracts titles
- `init()` - Initializes the filter

**Overridden methods:**
- `processElements(elements, topics)` - **OVERRIDES base** - Handles image URLs for tweets

**Special features:**
- Multiple container selectors for different tweet types
- Multiple title selector strategies
- Extracts image URLs from tweets

---

### YouTubeContentFilter

**Site-specific methods:**
- `extractItemElements()` - Finds video containers and extracts titles
- `init()` - Initializes the filter

**Overridden methods:**
- None

**Special features:**
- Supports multiple container types (grid, list, shorts, etc.)
- Multiple title selector strategies
- No media extraction (only titles)

---

### HackerNewsContentFilter

**Site-specific methods:**
- `extractItemElements()` - Finds story rows and extracts titles
- `getStoryElements(titleRow)` - Gets related elements for a story (metadata, spacer rows)
- `init()` - Initializes the filter

**Overridden methods:**
- `blurWaitingElement(element)` - **OVERRIDES base** - Handles multiple related elements per story
- `blurBlockedElement(element)` - **OVERRIDES base** - Handles multiple related elements per story
- `unblurElement(element)` - **OVERRIDES base** - Handles multiple related elements per story
- `processElements(elements, topics)` - **OVERRIDES base** - Passes element objects instead of just containers

**Special features:**
- Groups story title + metadata + spacer rows together
- Applies visual effects to all related elements as a unit
- Custom blur methods for multi-element items

---

### RedditContentFilter

**Site-specific methods:**
- `extractItemElements()` - Finds post containers and extracts titles
- `extractImageUrlsFromElements(elements)` - Extracts images/videos from posts
- `init()` - Initializes the filter

**Overridden methods:**
- `processElements(elements, topics)` - **OVERRIDES base** - Handles image/video URLs for posts

**Special features:**
- Works with modern Reddit's `shreddit-post` elements
- Extracts images/videos from three post types:
  - **Video posts**: Extracts poster image from `shreddit-player-2`
  - **Image posts**: Extracts from preview images
  - **Gallery posts**: Extracts up to 3 images from carousel

---

## Complete Flow Diagrams

### Flow 1: Initial Page Load (All Sites)

**All sites (YouTube, HackerNews, Reddit, X):**
```
ContentFilter.init()
  ↓
  calls setupMessageListener() [BASE]
  ↓
  calls waitForElements() [BASE]
    ↓
    polls until extractItemElements() returns items
    ↓
    calls checkFilteringState() [BASE]
      ↓
      retrieves filtering state from chrome.storage
      ↓
      if enabled:
        ↓
        calls processInitialElements(topics) [BASE]
          ↓
          extractItemElements() [SITE CLASS]
          ↓
          processElements(items, topics) [BASE or SITE]
            ↓
            sends to API
            ↓
            applies visual effects
        ↓
        calls startScrollMonitoring(topics, extractFn) [BASE]
          ↓
          sets up polling interval
```

---

### Flow 2: Scrolling (New Content Detection)

**All sites (YouTube, HackerNews, Reddit, X):**
```
BASE CLASS: pollForNewContent() [runs every 100-2000ms]
  ↓
  calls this.extractElementsFunction()
    ↓
    which is: () => this.extractItemElements() [SITE CLASS]
      ↓
      extracts new items
  ↓
  filters out already-processed items
  ↓
  if new items found:
    ↓
    calls processElements(newElements) [BASE or SITE CLASS]
      ↓
      marks as processed
      ↓
      blurs elements (waiting state)
      ↓
      sends to API
      ↓
      applies visual effects based on response
```

---

### Flow 3: User Toggles Filtering On/Off

```
User clicks toggle in popup
  ↓
  popup.js sends message to background.js
  ↓
  background.js sends message to content script
  ↓
  setupMessageListener() [BASE] receives message
  ↓
  if action === 'startFiltering':
    ↓
    calls processInitialElements(topics) [BASE]
      ↓
      extractItemElements() [SITE CLASS]
      ↓
      processElements(items, topics) [BASE or SITE]
    ↓
    calls startScrollMonitoring(topics, extractFn) [BASE]
  ↓
  if action === 'stopFiltering':
    ↓
    calls stopFiltering() [BASE]
      ↓
      calls stopScrollMonitoring() [BASE]
        ↓
        clears polling interval
        ↓
        removes scroll listeners
```

---

## Key Differences Between Sites

| Feature | X (Twitter) | YouTube | HackerNews | Reddit |
|---------|-------------|---------|------------|--------|
| **Media extraction** | ✅ (images/videos) | ❌ | ❌ | ✅ (images/videos/galleries) |
| **Multi-element items** | ❌ | ❌ | ✅ (story + metadata) | ❌ |
| **Custom blur methods** | ❌ | ❌ | ✅ | ❌ |
| **Override processElements** | ✅ (for images) | ❌ | ✅ (for multi-element) | ✅ (for images/videos) |
| **Multiple container selectors** | ✅ | ✅ | ❌ | ❌ |
| **Multiple title selectors** | ✅ | ✅ | ✅ | ✅ |

---

## Summary

**Common pattern for all sites:**
1. `init()` sets up the filter
2. `extractItemElements()` finds content (titles and possibly media)
3. `processInitialElements()` → `processElements()` handles initial load
4. `pollForNewContent()` → `processElements()` handles scrolling
5. Visual effects applied via `blur*Element()` methods

**Site-specific specializations:**
- **X (Twitter)**: Overrides `processElements()` to include image/video URLs
- **Reddit**: Overrides `processElements()` to include image/video/gallery URLs (supports video posters, images, and multi-image galleries)
- **HackerNews**: Groups multiple DOM elements per story (title + metadata + spacer), custom blur methods, overrides `processElements()` to pass element objects
- **YouTube**: Uses base class methods without overrides
