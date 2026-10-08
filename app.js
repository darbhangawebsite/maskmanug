const $ = (id) => document.getElementById(id);
const BASE = new URL('./', import.meta.url);
const fallbackConfig = {
  channelHandle: '@MaskManUG', oneSignalAppId: '', socials: {
    youtube: 'https://www.youtube.com/@MaskManUG',
    instagram: 'https://www.instagram.com/maskmanug/',
    discord: 'https://discord.gg/MFb7kBAjvv',
    twitch: 'https://www.twitch.tv/maskmanug', kick: ''
  }
};
let config = fallbackConfig;
let stream = null;
let lastLiveId = null;
let installEvent = null;
let oneSignal = null;
let toastTimer = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
const setText = (id, text) => { const el = $(id); if (el) el.textContent = String(text); };

function toast(message) {
  $('toast-message').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6400);
}
function showDialog(title, html) {
  setText('dialog-title', title);
  $('dialog-content').innerHTML = html;
  if (!$('help-dialog').open) $('help-dialog').showModal();
}
function buttonHref(id, url) {
  const el = $(id);
  if (el && /^https:\/\//.test(url || '')) el.href = url;
}
function socialLinks() {
  const s = config.socials || {};
  buttonHref('hero-watch', `${s.youtube || fallbackConfig.socials.youtube}/live`);
  buttonHref('youtube-watch-link', `${s.youtube || fallbackConfig.socials.youtube}/live`);
  buttonHref('poster-link', `${s.youtube || fallbackConfig.socials.youtube}/live`);
  buttonHref('sidebar-channel-link', s.youtube);
  buttonHref('footer-youtube', s.youtube);
  buttonHref('view-all', `${s.youtube || fallbackConfig.socials.youtube}/videos`);
  buttonHref('footer-instagram', s.instagram);
  buttonHref('footer-discord', s.discord);
  buttonHref('footer-twitch', s.twitch);
  buttonHref('community-instagram', s.instagram);
  buttonHref('community-discord', s.discord);
  if (s.kick && /^https:\/\//.test(s.kick)) { $('footer-kick').hidden = false; buttonHref('footer-kick', s.kick); }
}

function formatSubscribers(count) {
  if (!Number.isFinite(Number(count)) || count === null) return 'GAMING';
  const n = Number(count);
  return n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M+` : n >= 1000 ? `${(n / 1000).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K+` : `${n}`;
}
function relativeDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'RECENT VIDEO';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  if (days < 30) return `${days} DAYS AGO`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date).toUpperCase();
}
function safeVideoId(value) { return typeof value === 'string' && /^[\w-]{11}$/.test(value) ? value : null; }
function renderVideos(videos) {
  if (!Array.isArray(videos) || videos.length === 0) return;
  const grid = $('video-grid'); grid.replaceChildren();
  videos.slice(0, 6).forEach((video, index) => {
    const id = safeVideoId(video.id);
    if (!id) return;
    const link = document.createElement('a'); link.className = 'video-card'; link.target = '_blank';
    link.rel = 'noopener noreferrer'; link.href = `https://www.youtube.com/watch?v=${id}`;
    const imgWrap = document.createElement('div'); imgWrap.className = 'video-card-image';
    const img = document.createElement('img'); img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    img.alt = String(video.title || 'MaskManUG video'); img.loading = 'lazy';
    imgWrap.append(img);
    const overlay = document.createElement('div'); overlay.className = 'video-card-overlay';
    const badge = document.createElement('span'); badge.textContent = video.kind === 'live' ? 'LIVE REPLAY' : 'WATCH VIDEO'; overlay.append(badge); imgWrap.append(overlay);
    const content = document.createElement('div'); content.className = 'video-card-content';
    const kicker = document.createElement('small'); kicker.textContent = `DROP ${String(index + 1).padStart(2, '0')} // MASKMANUG`;
    const title = document.createElement('h3'); title.textContent = video.title || 'New on MaskManUG';
    const footer = document.createElement('div'); footer.className = 'video-card-footer';
    const date = document.createElement('span'); date.textContent = relativeDate(video.publishedAt);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; footer.append(date, arrow);
    content.append(kicker, title, footer); link.append(imgWrap, content); grid.append(link);
  });
}
function renderLive(data) {
  const configured = data?.configured === true;
  const stale = configured && (!data.checkedAt || Date.now() - new Date(data.checkedAt).getTime() > 3 * 60 * 60 * 1000);
  const current = !stale && data?.live && safeVideoId(data.live.id) ? data.live : null;
  const chip = $('stream-status');
  chip.className = 'status-chip ' + (current ? 'status-live' : stale || !configured ? 'status-loading' : 'status-offline');
  setText('status-text', current ? 'LIVE RIGHT NOW' : stale ? 'STATUS UNVERIFIED' : configured ? 'CURRENTLY OFFLINE' : 'SETUP REQUIRED');
  setText('sidebar-status-short', current ? 'ON AIR' : stale ? 'UNVERIFIED' : configured ? 'OFF AIR' : 'NOT CONFIGURED');
  const youtube = config.socials?.youtube || fallbackConfig.socials.youtube;
  if (current) {
    setText('sidebar-state-label', 'SIGNAL CONNECTED');
    setText('sidebar-state', 'WE ARE\nLIVE NOW.');
    $('sidebar-state').style.whiteSpace = 'pre-line';
    setText('sidebar-note', 'MaskManUG is streaming right now. Jump in, say hello, and catch the chaos as it happens.');
    setText('stream-category', '● LIVE // GTA ROLEPLAY');
    setText('stream-title', current.title || 'MaskManUG is live');
    setText('stream-description', 'Live on YouTube · Join the conversation now');
    const watchUrl = `https://www.youtube.com/watch?v=${current.id}`;
    ['hero-watch', 'youtube-watch-link', 'poster-link'].forEach(id => buttonHref(id, watchUrl));
    $('hero-watch').innerHTML = '<span class="play-symbol">▶</span> WATCH LIVE NOW <span class="button-arrow">↗</span>';
    if (lastLiveId !== current.id) {
      $('video-frame').replaceChildren();
      const iframe = document.createElement('iframe');
      // youtube-nocookie embed is privacy-enhanced; no user data is forwarded before this stream loads.
      iframe.src = `https://www.youtube-nocookie.com/embed/${current.id}?autoplay=0&rel=0`;
      iframe.title = current.title || 'MaskManUG live stream';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin'; iframe.allowFullscreen = true;
      $('video-frame').append(iframe);
      lastLiveId = current.id;
    }
  } else {
    setText('sidebar-state-label', stale ? 'SIGNAL DELAYED' : configured ? 'SIGNAL STANDBY' : 'AWAITING SIGNAL');
    setText('sidebar-state', stale ? 'CHECK\nYOUTUBE.' : configured ? 'BACK\nSOON.' : 'GET READY\nTO TUNE IN.');
    $('sidebar-state').style.whiteSpace = 'pre-line';
    setText('sidebar-note', stale ? 'The last YouTube check is outdated. Use the channel link to confirm whether MaskManUG is live.' : configured ? 'The channel is currently offline. Hit the bell to get a notification when the next stream begins.' : 'Connect the YouTube API to automatically detect new live streams and sync the latest videos.');
    setText('stream-category', 'GTA V ROLEPLAY');
    setText('stream-title', configured ? 'The stream will be back soon' : 'Catch the next MaskManUG stream');
    setText('stream-description', 'Catch up on the latest videos while you wait.');
    buttonHref('hero-watch', `${youtube}/live`);
    buttonHref('youtube-watch-link', `${youtube}/live`);
    buttonHref('poster-link', `${youtube}/live`);
    $('hero-watch').innerHTML = '<span class="play-symbol">▶</span> CHECK LIVE STREAM <span class="button-arrow">↗</span>';
    if (lastLiveId !== null) {
      $('video-frame').replaceChildren();
      const poster = document.createElement('div'); poster.className = 'stream-poster'; poster.innerHTML = '<div class="poster-rays"></div><div class="poster-brand">MM<span>UG.</span></div><div class="poster-overlay"><span>STREAM HQ // MASKMANUG</span><h3>THE BEST MOMENTS<br>ARE UNSCRIPTED.</h3><p>Catch the next stream.</p></div><div class="poster-action"><a class="round-play" target="_blank" rel="noopener noreferrer" aria-label="Open YouTube live">▶</a></div>';
      poster.querySelector('a').href = `${youtube}/live`;
      $('video-frame').append(poster); lastLiveId = null;
    }
  }
}
async function fetchChannelData() {
  try {
    const response = await fetch(new URL('data/channel.json', BASE), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Invalid channel data');
    stream = data;
    renderLive(data);
    renderVideos(data.videos);
    if (typeof data.channel?.avatar === 'string' && /^https:\/\//.test(data.channel.avatar)) {
      $('channel-avatar').src = data.channel.avatar;
      $('avatar-frame').hidden = false;
    }
    if (data.channel?.subscriberCount != null) {
      setText('subscriber-count', formatSubscribers(data.channel.subscriberCount));
      $('subscriber-count').nextElementSibling.textContent = 'SUBSCRIBERS';
    }
  } catch (error) {
    console.warn('Channel status unavailable:', error);
    renderLive({ configured: false });
  }
}

function installInstructions() {
  if (isStandalone()) { toast('MaskManUG is already installed as an app!'); return; }
  if (installEvent) {
    const event = installEvent; installEvent = null;
    event.prompt();
    event.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') toast('App installation requested!');
    }).catch(console.warn);
    return;
  }
  if (isIOS) {
    showDialog('Install on iPhone / iPad', '<p>Open this page in <strong>Safari</strong>, then:</p><ol><li>Tap the <strong>Share</strong> icon (square with an up arrow).</li><li>Tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong> to install MaskManUG.</li></ol><p>For iPhone live notifications, open the installed app and enable alerts there (iOS 16.4+).</p>');
  } else {
    showDialog('Add MaskManUG as an app', '<p>For Chrome or Edge on Android / desktop:</p><ol><li>Open the browser menu (⋮ or ⋯).</li><li>Choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li><li>Confirm to add MaskManUG.</li></ol><p>Use HTTPS after deploying on GitHub Pages. Support varies by browser.</p>');
  }
}

async function initOneSignal() {
  if (!config.oneSignalAppId) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; script.defer = true;
    script.onerror = () => reject(new Error('OneSignal SDK failed to load'));
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: config.oneSignalAppId,
          serviceWorkerPath: new URL('push/OneSignalSDKWorker.js', BASE).pathname,
          serviceWorkerParam: { scope: new URL('push/', BASE).pathname },
          notifyButton: { enable: false },
          autoResubscribe: true
        });
        oneSignal = OneSignal;
        setText('sidebar-status-short', stream?.live ? 'ON AIR' : stream?.configured ? 'OFF AIR' : 'NOT CONFIGURED');
        resolve(OneSignal);
      } catch (error) { reject(error); }
    });
    document.head.append(script);
  });
}
async function enableAlerts() {
  if (!config.oneSignalAppId) {
    showDialog('Live notifications setup', '<p>The notification button is ready, but the site owner must first connect <strong>OneSignal Web Push</strong>.</p><p>Add your OneSignal <strong>App ID</strong> to <code>config.json</code> and your private REST API key to GitHub Actions secrets. After deployment, visitors can subscribe to alerts.</p><p>You can still subscribe to the channel on YouTube for its native notifications.</p>');
    return;
  }
  if (isIOS && !isStandalone()) {
    showDialog('Install first on iPhone', '<p>On iOS 16.4 or later, web push notifications require the site to be added to the Home Screen.</p><ol><li>Open this site in Safari.</li><li>Tap Share → Add to Home Screen.</li><li>Open the installed MaskManUG app and tap Live Notifications again.</li></ol>');
    return;
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    toast('Push notifications are not supported in this browser.'); return;
  }
  if (Notification.permission === 'denied') {
    showDialog('Notifications are blocked', '<p>Notifications were blocked for this site. Open your device or browser <strong>Site settings → Notifications</strong>, allow MaskManUG, then try again.</p>');
    return;
  }
  try {
    if (!oneSignal) await initOneSignal();
    if (!oneSignal) throw new Error('OneSignal is unavailable');
    if (oneSignal.User.PushSubscription.optedIn) {
      showDialog('Live alerts are enabled', '<p>You are subscribed to MaskManUG live alerts. Notifications will be sent when a new live broadcast is detected.</p><p>Want to stop alerts on this device?</p><button type="button" id="disable-alerts" class="button button-outline">TURN OFF NOTIFICATIONS</button>');
      $('disable-alerts').addEventListener('click', async () => {
        await oneSignal.User.PushSubscription.optOut();
        $('help-dialog').close(); toast('Live alerts turned off for this browser.');
      });
      return;
    }
    await oneSignal.Notifications.requestPermission();
    if (Notification.permission !== 'granted') { toast('Notification permission was not granted.'); return; }
    await oneSignal.User.PushSubscription.optIn();
    toast(oneSignal.User.PushSubscription.optedIn ? 'Live alerts enabled! See you at the next stream.' : 'Permission granted. Please try subscribing again.');
  } catch (error) {
    console.error('Push registration error:', error);
    toast('Could not enable alerts. Check browser permissions and your OneSignal setup.');
  }
}

function initButtons() {
  $('toast-close').addEventListener('click', () => { $('toast').hidden = true; });
  $('dialog-close').addEventListener('click', () => $('help-dialog').close());
  $('dialog-done').addEventListener('click', () => $('help-dialog').close());
  $('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) $('help-dialog').close(); });
  ['install-header', 'install-main'].forEach(id => $(id).addEventListener('click', installInstructions));
  ['header-notify', 'hero-alerts', 'alerts-main'].forEach(id => $(id).addEventListener('click', enableAlerts));
  $('menu-toggle').addEventListener('click', () => {
    const menu = $('mobile-nav'); menu.hidden = !menu.hidden;
    $('menu-toggle').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.querySelectorAll('.mobile-nav a').forEach(a => a.addEventListener('click', () => { $('mobile-nav').hidden = true; $('menu-toggle').setAttribute('aria-expanded', 'false'); }));
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; });
  window.addEventListener('appinstalled', () => { installEvent = null; toast('MaskManUG has been installed!'); });
  if (isStandalone()) setText('install-hint', 'Installed app mode is active. Enjoy the stream hub!');
  $('copyright-year').textContent = new Date().getFullYear();
}

async function main() {
  initButtons();
  try {
    const response = await fetch(new URL('config.json', BASE), { cache: 'no-store' });
    if (response.ok) {
      const custom = await response.json();
      config = { ...fallbackConfig, ...custom, socials: { ...fallbackConfig.socials, ...(custom.socials || {}) } };
    }
  } catch (error) { console.warn('Config could not be loaded', error); }
  socialLinks();
  await fetchChannelData();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(new URL('sw.js', BASE), { scope: BASE.pathname })
      .catch(error => console.warn('PWA cache registration failed', error));
  }
  if (config.oneSignalAppId) initOneSignal().catch(error => console.warn('Push SDK initialization failed:', error));
  setInterval(fetchChannelData, 90_000);
}
main();
