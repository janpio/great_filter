const { isLiveMode } = require('./test-mode');

const YOU_TUBE_URL = 'https://www.youtube.com/';
const HACKER_NEWS_URL = 'https://news.ycombinator.com/';
const REDDIT_URL = 'https://www.reddit.com/';
const X_URL = 'https://x.com/';

const youtubeHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>YouTube Fixture</title>
    <style>
      body { font-family: Arial, sans-serif; }
      ytd-rich-grid-media { display: block; padding: 16px; border-bottom: 1px solid #ccc; }
    </style>
  </head>
  <body>
    <ytd-rich-grid-media>
      <yt-formatted-string id="video-title">Politics roundup 2024</yt-formatted-string>
    </ytd-rich-grid-media>
    <ytd-rich-grid-media>
      <yt-formatted-string id="video-title">Daily science briefing</yt-formatted-string>
    </ytd-rich-grid-media>
  </body>
</html>
`;

const redditHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Reddit Fixture</title>
  </head>
  <body>
    <shreddit-post post-type="image">
      <div class="post-body">
        <a slot="title" id="post-title-1">Politics discussion thread</a>
        <img class="preview-img" src="https://i.redd.it/politics-image.jpg" />
      </div>
    </shreddit-post>
    <shreddit-post post-type="video">
      <div class="post-body">
        <a slot="title" id="post-title-2">Wildlife documentary</a>
        <shreddit-player-2 poster="https://i.redd.it/wildlife-video.jpg"></shreddit-player-2>
      </div>
    </shreddit-post>
  </body>
</html>
`;

const hackerNewsHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Hacker News Fixture</title>
  </head>
  <body>
    <table class="itemlist">
      <tr class="athing submission" id="1">
        <td class="title"><span class="rank">1.</span></td>
        <td class="titleline"><a href="#">Politics claims reach new highs</a></td>
      </tr>
      <tr class="spacer"></tr>
      <tr class="athing submission" id="2">
        <td class="title"><span class="rank">2.</span></td>
        <td class="titleline"><a href="#">New programming language released</a></td>
      </tr>
    </table>
  </body>
</html>
`;

const xHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>X Fixture</title>
  </head>
  <body>
    <article data-testid="tweet">
      <div data-testid="tweetText">Politics update trending worldwide</div>
      <div data-testid="tweetPhoto" aria-label="Image showing political rally">
        <img aria-label="Image showing political rally" src="https://pbs.twimg.com/media/political.jpg" />
      </div>
    </article>
    <article data-testid="tweet">
      <div data-testid="tweetText">Astronomy picture of the day</div>
    </article>
  </body>
</html>
`;

async function loadYouTube(page) {
  if (isLiveMode()) {
    // Hit search results (public access) rather than the personalized feed that may redirect.
    await page.goto('https://www.youtube.com/results?search_query=technology+news', {
      waitUntil: 'domcontentloaded',
    });

    // Clear Google consent overlays if they appear.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!(page.url().includes('consent') || (await page.locator('form[action*="consent"]').count()) > 0)) {
        break;
      }

      const consentButton = page.locator('form[action*="consent"] button[type="submit"], form[action*="consent"] button');
      if (await consentButton.count()) {
        await consentButton.first().click({ timeout: 5000 });
        await page.waitForLoadState('domcontentloaded');
        continue;
      }

      const agreeButton = page.locator('button:has-text("Agree"), button:has-text("I agree"), button:has-text("Accept all")');
      if (await agreeButton.count()) {
        await agreeButton.first().click({ timeout: 5000 });
        await page.waitForLoadState('domcontentloaded');
        continue;
      }

      await page.waitForTimeout(1000);
    }

    if (!page.url().startsWith('https://www.youtube.com/')) {
      await page.goto('https://www.youtube.com/results?search_query=technology+news', {
        waitUntil: 'domcontentloaded',
      });
    }

    try {
      // YouTube may require watch history to be on; acknowledge the modal if present.
      const historyDialog = page.locator('yt-confirm-dialog-renderer, tp-yt-paper-dialog');
      if (await historyDialog.count()) {
        const turnOnButtons = page.locator(
          'button:has-text("TURN ON"), button:has-text("Turn on"), button:has-text("Turn On"), button:has-text("Yes, I\'m in")'
        );
        if (await turnOnButtons.count()) {
          await turnOnButtons.first().click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded');
        }
      }
    } catch (error) {
      console.warn('YouTube view history prompt handling failed:', error);
    }

    return;
  }

  await routeHtml(page, YOU_TUBE_URL, youtubeHtml);
}

async function loadReddit(page) {
  if (isLiveMode()) {
    // Reddit shows cookie and region prompts to anonymous visitors.
    await page.goto(REDDIT_URL, { waitUntil: 'domcontentloaded' });
    const acceptButton = page.locator('button:has-text("Accept all")');
    if (await acceptButton.count()) {
      await acceptButton.first().click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded');
    }
    const continueButton = page.locator('button:has-text("Continue")');
    if (await continueButton.count()) {
      await continueButton.first().click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded');
    }
    return;
  }

  await routeHtml(page, REDDIT_URL, redditHtml);
}

async function loadHackerNews(page) {
  await routeHtml(page, HACKER_NEWS_URL, hackerNewsHtml);
}

async function loadX(page) {
  if (isLiveMode()) {
    // Use a public profile instead of the logged-in feed to avoid auth prompts.
    await page.goto('https://x.com/PopSci', { waitUntil: 'domcontentloaded' });

    // Dismiss sign-in/upsell modals that block scrolling.
    const dismissSelectors = [
      'button[data-testid="sheetDialog-secondaryButton"]',
      'button[data-testid="confirmationSheetCancel"]',
      'button:has-text("Not now")',
      'button:has-text("Maybe later")',
      'div[role="button"] span:has-text("Not now")',
    ];

    for (let attempt = 0; attempt < 3; attempt++) {
      let dismissed = false;
      for (const selector of dismissSelectors) {
        const element = page.locator(selector);
        if (await element.count()) {
          await element.first().click({ timeout: 5000 });
          await page.waitForTimeout(500);
          dismissed = true;
        }
      }

      // Safety net: remove any lingering modal DOM nodes so tweets stay visible.
      await page.evaluate(() => {
        const dialogs = document.querySelectorAll('div[aria-modal="true"]');
        dialogs.forEach(dialog => dialog.remove());
        document.body.style.overflow = 'auto';
      });

      if (!dismissed) {
        break;
      }
    }

    return;
  }

  await routeHtml(page, X_URL, xHtml);
}

async function routeHtml(page, targetUrl, html) {
  if (isLiveMode()) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    return;
  }

  const urlPattern = `${targetUrl}**`;
  await page.route(urlPattern, async route => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({
        status: 200,
        body: html,
        contentType: 'text/html',
      });
    } else {
      await route.continue();
    }
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
}

module.exports = {
  loadYouTube,
  loadReddit,
  loadHackerNews,
  loadX,
};
