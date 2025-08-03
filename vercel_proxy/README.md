# Great Filter Proxy Server

This is a Vercel-based proxy server for the Great Filter Chrome extension. It securely handles OpenRouter API calls without exposing the API key in the extension code.

## Setup

1. **Deploy to Vercel:**
   ```bash
   cd vercel_vps
   vercel deploy
   ```

2. **Set Environment Variables:**
   In your Vercel dashboard, add:
   - `OPENROUTER_API_KEY`: Your OpenRouter API key

3. **Update Extension:**
   Update the extension's `config.js` to use your deployed proxy URL.

## API Endpoint

- **POST** `/api/proxy` - Proxies requests to OpenRouter API

The proxy accepts the same payload as the OpenRouter API and returns the same response format.

## Local Development

1. Create `.env.local` from `.env.example`
2. Add your OpenRouter API key
3. Run `vercel dev`