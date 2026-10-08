# MaskManUG — Stream Hub 🎮

A custom, responsive, **GitHub Pages-ready Progressive Web App (PWA)** for [MaskManUG](https://www.youtube.com/@MaskManUG).

The site has an embedded YouTube livestream when broadcasting, a latest-video section, social/community links, phone **Add to Home Screen** installation, optional automatic **web push notifications**, and a GitHub Actions workflow that updates live status approximately every 20 minutes.

**This is a static PWA, not an APK or an App Store app.** It supports compatible Android phones, iPhones, and desktop browsers. The website itself requires no paid backend. Google/OneSignal services require configuration, and their quotas, limits, and terms apply.

## Preview / files

- `index.html`, `styles.css`, `app.js` — the web app and design.
- `config.json` — PUBLIC creator information; set channel handle, social links, optional OneSignal App ID, optional site URL.
- `data/channel.json` — generated live/channel snapshot (ships with an honest "not configured" state).
- `manifest.webmanifest`, `sw.js`, `icons/` — installation, home-screen icons, and offline app shell.
- `push/OneSignalSDKWorker.js` — separate notification subscription worker.
- `scripts/update-channel.mjs` — Google YouTube Data API live detection + recent videos + OneSignal alert sending.
- `.github/workflows/deploy.yml` — checks the YouTube channel and publishes to GitHub Pages.

> The included **MM home-screen icons are temporary typographic placeholders**, not a recreation of your exact existing MaskManUG master logo. Replace `icons/icon-192.png` and `icons/icon-512.png` with correctly sized transparent or square versions of your own original logo when available. After the YouTube API is connected, the website also displays the avatar published on your YouTube channel.

## 1. Upload to GitHub

1. Create a **new public GitHub repository** (example `maskmanug-website`).
2. Download the ZIP, extract it, then upload **the contents of the folder** into the repository (not an extra nested folder). Include hidden `.github` and `.nojekyll` paths.
3. Ensure your main branch is named `main`.
4. In GitHub **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**.
5. Go to **Actions → Sync streams & deploy site → Run workflow** once. You can also trigger a run by editing a file on the `main` branch.
6. Your website should be available at `https://YOUR_GITHUB_USERNAME.github.io/REPOSITORY_NAME/` after a successful deployment. GitHub Pages may require a few minutes to provision on first use.

For a user site repository named `YOUR_GITHUB_USERNAME.github.io`, the site is at `https://YOUR_GITHUB_USERNAME.github.io/`.

**No `npm install`, Vite, or paid VPS needed** for the published website. You only need GitHub, Google Cloud (YouTube API), and optionally OneSignal.

## 2. Make YouTube live detection work

Without an API key, the website still loads, social links work, app installation works, and the site links to your live YouTube page — but **it will not assert that you are live or populate videos automatically**.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project.
2. Enable **YouTube Data API v3** in **APIs & Services → Library**.
3. Open **APIs & Services → Credentials**, create an **API key**, and restrict it to the **YouTube Data API v3** (API restrictions). Keep it PRIVATE: do not paste the key into `config.json` or commit it.
4. Go to your GitHub repo **Settings → Secrets and variables → Actions → New repository secret**:
   - **Name:** `YOUTUBE_API_KEY`
   - **Secret:** your API key
5. Open `config.json` and confirm `"channelHandle": "@MaskManUG"` is correct.
6. Run **Actions → Sync streams & deploy site → Run workflow** to fetch the live status, avatar, subscribers, and recent videos.

The workflow checks the YouTube channel approximately every **20 minutes** (`*/20 * * * *`). GitHub schedules are best effort, so the live badge/alerts can be delayed. The page checks its own published snapshot every 90 seconds while open, but that does **not** make the source YouTube detection real time. YouTube live discovery can itself lag.

The workflow uses `search.list` with `eventType=live` for active broadcasts, plus low-cost endpoints for uploads and metadata. It performs one YouTube Search API request per 20-minute check — normally around **72 searches per day**. Make sure this is compatible with your project's current YouTube quota. If your channel has unusual quota limits, adjust the cron schedule.

Once configured, a red **LIVE RIGHT NOW** badge and embedded player appear when the broadcast is discovered. When offline, the site shows an offline/standby state and recent content. A stale live status (older than 3 hours) is treated as unverified by the frontend.

## 3. Activate real push notifications (optional)

The button and UI are included. Actual background live alerts **will not function until OneSignal is configured**. A PWA service worker alone cannot send push notifications without a sending provider or backend.

1. Create a [OneSignal](https://onesignal.com/) account and a **Web Push** app.
2. In the OneSignal web setup, set your **exact published HTTPS site URL** (including your GitHub Pages repository path if used) and configure the supported web push platform.
3. Copy your public **OneSignal App ID** into `config.json` as `"oneSignalAppId": "YOUR-APP-ID"`. This ID is intended to be public.
4. In OneSignal **Settings → Keys & IDs**, obtain your **private App API / REST API key**.
5. Add a GitHub Actions repository secret named `ONESIGNAL_REST_API_KEY` containing that private key. **Never** add it to HTML, JavaScript, or `config.json`.
6. Commit and rerun the workflow to publish the new `config.json`.
7. Open the deployed site in a compatible browser and press **GET LIVE ALERTS** to subscribe. Check the subscription in OneSignal's dashboard (Audience → Subscriptions) and send yourself a test notification from OneSignal before trusting automatic delivery.

When a **new broadcast video ID** is detected, the GitHub Action sends one OneSignal push request targeting the provider's **Subscribed Users** segment. The notification links to that YouTube stream. It only sends for a newly detected live ID compared with the last committed live status. It does not repeatedly send for the same stream on every check.

### iPhone / Android notes

- **Android:** Chrome/Edge can typically install the app and subscribe from the HTTPS site if supported.
- **iPhone:** Use Safari to choose **Share → Add to Home Screen**, open the installed icon, and then enable alerts. Web push for home-screen web apps requires **iOS 16.4+** and user permission. Your chosen browser, OS, and OneSignal setup must support push.
- **Desktop:** Modern browsers can usually install the PWA and enable notifications, subject to permission rules.
- Notification delivery may be delayed or blocked by battery settings, browser policies, service limitations, or revoked permissions.

A user can unsubscribe using the same **Live Notifications** button after opting in.

## 4. Customize the channel and social links

Open `config.json`:

```json
{
  "channelHandle": "@MaskManUG",
  "oneSignalAppId": "",
  "siteUrl": "",
  "socials": {
    "youtube": "https://www.youtube.com/@MaskManUG",
    "instagram": "https://www.instagram.com/maskmanug/",
    "discord": "https://discord.gg/MFb7kBAjvv",
    "twitch": "https://www.twitch.tv/maskmanug",
    "kick": ""
  }
}
```

The Kick link is hidden until you add your verified Kick profile URL. Use `"siteUrl"` if publishing on a custom domain, including the trailing `/`. Alternatively set the GitHub Actions **variable** `PUBLIC_SITE_URL`; the `siteUrl` value takes precedence.

Edit labels, colors and wording in `index.html` / `styles.css` as you like. Make sure the homepage icon files stay named `icons/icon-192.png` and `icons/icon-512.png` and remain 192×192 and 512×512 respectively.

## 5. Local preview

Because the frontend fetches JSON, serve the folder on localhost instead of opening `index.html` directly by double-clicking:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. On localhost app-install service worker support may work in supported browsers. OneSignal subscriptions should be tested on the deployed HTTPS origin.

You can sanity-check script syntax with:

```bash
node --check app.js
node --check scripts/update-channel.mjs
```

## 6. Troubleshooting

- **The page says SETUP REQUIRED:** Check that `YOUTUBE_API_KEY` is present and the scheduled workflow finished. Inspect **Actions** logs for API/permission errors.
- **GitHub Action cannot push commits:** In **Settings → Actions → General → Workflow permissions**, enable permission for GitHub Actions to write to the repository where allowed. The workflow itself requests `contents: write`.
- **The page doesn't update right after going live:** Live checks are scheduled at ~20-minute intervals and the GitHub scheduler is not guaranteed to run exactly on time. Use `Run workflow` for an immediate on-demand check.
- **Push prompt fails:** Verify HTTPS, OneSignal App ID, configured domain and worker at `/REPOSITORY_NAME/push/OneSignalSDKWorker.js`, browser notifications, and iOS installed-app requirements. If OneSignal reports an unsupported site URL, follow its current web-push setup guidance.
- **iOS not installing:** Use Safari's Share menu; the install prompt button intentionally shows a help dialog when automatic PWA install isn't supported.
- **GitHub public repo unused for a long time:** Scheduled workflows can be automatically disabled after prolonged repository inactivity (see GitHub's current workflow schedule policy). Re-enable them in Actions if needed.
- **Custom domain:** Configure it in **Settings → Pages** as well, and set `siteUrl` so notification icons use the correct URL.
- **Video player doesn't appear:** A live video must be detected and allow embedding; for embed-restricted streams use the "Open on YouTube" arrow.

## Security & privacy

- Private keys live **only in GitHub Actions secrets**. The static site contains only publicly safe settings and published channel data.
- The OneSignal SDK is **not loaded at all** until you add an App ID. Browser permission is requested only when a visitor taps the notification button (OneSignal may initialize its service without prompting before that).
- YouTube thumbnails and embedded players are fetched from YouTube when displayed. The embed is privacy-enhanced (`youtube-nocookie.com`) but still depends on YouTube's own policies.
- The website avoids a backend/database; GitHub Actions compares the current and previous broadcast IDs to avoid duplicate live-start messages.

**Not included:** real-time (second-by-second) WebSocket live monitoring, native Android/iOS app binaries, an integrated chat-backend, or fully automatic push before the provider is set up.
