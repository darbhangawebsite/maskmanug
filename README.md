# MaskManUG Streaming Website

A custom responsive streaming hub for **MaskManUG**, focused on GTA RP and **Gorib**.

## Included

- Automatic YouTube live detection
- Live YouTube player while the channel is streaming
- Latest-upload fallback while offline
- Recent-video grid
- GTA RP / Gorib creator introduction
- YouTube, Instagram, Twitch and Facebook links
- Editable X/Twitter and Discord placeholders
- Responsive desktop/mobile UI
- API key stays server-side
- No npm packages required

## Already configured

YouTube channel ID: `UC9FFwFD6KqgZRHpOzIIhlbA`

## Run it

Requires Node.js 20.12 or newer.

1. Copy `.env.example` to `.env`.
2. Enable **YouTube Data API v3** in Google Cloud and create an API key.
3. Put the key in `.env`:

```env
YOUTUBE_API_KEY=YOUR_KEY_HERE
YOUTUBE_CHANNEL_ID=UC9FFwFD6KqgZRHpOzIIhlbA
PORT=3000
```

4. Start:

```bash
npm start
```

or simply:

```bash
node server.js
```

5. Open `http://localhost:3000`

Without an API key, the full website still loads and the direct YouTube Live button works; automatic live detection and recent uploads activate after the key is added.

## Change social links

Open `public/index.html` and edit the cards inside the `social-grid` section. YouTube, Instagram, Twitch and Facebook are prefilled. X/Twitter and Discord are intentionally left as placeholders until their exact URLs are supplied.

## Deploy

Upload the folder to any Node.js server/VPS. Set the same environment variables there and run `node server.js` under your preferred process manager (PM2/systemd/CyberPanel Node app, etc.).
