const CHANNEL_ID = 'UC9FFwFD6KqgZRHpOzIIhlbA';
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;

const state = {
  loaded: false,
  refreshTimer: null,
};

const $ = (id) => document.getElementById(id);
const playerStage = $('playerStage');
const liveBadge = $('liveBadge');
const streamType = $('streamType');
const streamTitle = $('streamTitle');
const videoGrid = $('videoGrid');

function decodeHtml(input = '') {
  const el = document.createElement('textarea');
  el.innerHTML = input;
  return el.value;
}

function setBadge(kind, text) {
  liveBadge.className = `status-badge ${kind}`;
  liveBadge.innerHTML = `<span></span><b>${text}</b>`;
}

function setPlayer(videoId, title, isLive) {
  if (!videoId) return;
  playerStage.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&playsinline=1"
      title="${title.replaceAll('"', '&quot;')}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen>
    </iframe>`;
  streamType.textContent = isLive ? 'LIVE NOW' : 'LATEST UPLOAD';
  streamTitle.textContent = title;
}

function renderVideoCards(videos = []) {
  if (!videos.length) {
    videoGrid.innerHTML = `<div class="empty-videos">Latest videos will appear here after you add the YouTube Data API key. <a href="${CHANNEL_URL}" target="_blank" rel="noopener">Open the channel →</a></div>`;
    return;
  }

  videoGrid.innerHTML = videos.slice(0, 6).map(video => {
    const title = decodeHtml(video.title || 'MaskManUG video');
    const date = video.publishedAt ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(video.publishedAt)) : 'Latest upload';
    return `
      <a class="video-card" href="https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}" target="_blank" rel="noopener">
        <div class="video-thumb">
          <img src="${video.thumbnail || ''}" alt="${title.replaceAll('"', '&quot;')}" loading="lazy" />
          <div class="video-play"><span>▶</span></div>
        </div>
        <div class="video-info"><small>${date.toUpperCase()}</small><h3>${title}</h3></div>
      </a>`;
  }).join('');
}

function showApiFallback() {
  setBadge('offline', 'Live auto-check needs API key');
  streamType.textContent = 'CHANNEL LIVE PAGE';
  streamTitle.textContent = 'MaskManUG — GTA RP';
  playerStage.innerHTML = `
    <div class="offline-panel">
      <span class="offline-icon">▶</span>
      <h3>Live window ready.</h3>
      <p>Add your YouTube Data API key to enable automatic live detection and latest-upload fallback. The direct YouTube live page still works now.</p>
      <a class="button primary" style="margin-top:10px" href="${CHANNEL_URL}/live" target="_blank" rel="noopener">Check YouTube Live ↗</a>
    </div>`;
  renderVideoCards([]);
}

async function refreshYouTube() {
  try {
    const response = await fetch('/api/youtube/status', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      if (data.code === 'NO_API_KEY') {
        showApiFallback();
        return;
      }
      throw new Error(data.message || 'YouTube request failed');
    }

    if (data.isLive && data.live?.videoId) {
      const title = decodeHtml(data.live.title || 'MaskManUG is LIVE');
      setBadge('live', 'LIVE NOW');
      setPlayer(data.live.videoId, title, true);
    } else if (data.latest?.length) {
      const latest = data.latest[0];
      const title = decodeHtml(latest.title || 'Latest MaskManUG upload');
      setBadge('offline', 'Currently offline');
      setPlayer(latest.videoId, title, false);
    } else {
      setBadge('offline', 'Currently offline');
    }

    renderVideoCards(data.latest || []);
    state.loaded = true;
  } catch (error) {
    console.error(error);
    setBadge('offline', 'YouTube temporarily unavailable');
    if (!state.loaded) showApiFallback();
  }
}

$('year').textContent = new Date().getFullYear();
refreshYouTube();
state.refreshTimer = setInterval(refreshYouTube, 60_000);
