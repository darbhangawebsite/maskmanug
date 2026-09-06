import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { process.loadEnvFile?.(); } catch { /* .env is optional */ }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UC9FFwFD6KqgZRHpOzIIhlbA';
const API_KEY = process.env.YOUTUBE_API_KEY || '';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload, cache = 'no-store') {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

function youtubeUrl(endpoint, params = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  url.searchParams.set('key', API_KEY);
  return url;
}

async function youtubeFetch(endpoint, params) {
  if (!API_KEY) {
    const error = new Error('YouTube API key is not configured');
    error.code = 'NO_API_KEY';
    throw error;
  }
  const response = await fetch(youtubeUrl(endpoint, params), { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
  return response.json();
}

async function getYoutubeStatus() {
  const live = await youtubeFetch('search', {
    part: 'snippet', channelId: CHANNEL_ID, eventType: 'live', type: 'video', maxResults: 1
  });
  const latestData = await youtubeFetch('search', {
    part: 'snippet', channelId: CHANNEL_ID, order: 'date', type: 'video', maxResults: 6
  });

  const liveItem = live.items?.[0] || null;
  const normalize = item => ({
    videoId: item.id?.videoId,
    title: item.snippet?.title,
    description: item.snippet?.description,
    publishedAt: item.snippet?.publishedAt,
    thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url
  });

  return {
    ok: true,
    channelId: CHANNEL_ID,
    isLive: Boolean(liveItem),
    live: liveItem ? normalize(liveItem) : null,
    latest: (latestData.items || []).map(normalize).filter(v => v.videoId)
  };
}

async function serveStatic(reqPath, res) {
  let decoded;
  try { decoded = decodeURIComponent(reqPath); } catch { decoded = '/'; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(publicDir, relative);
  if (!target.startsWith(publicDir + path.sep) && target !== path.join(publicDir, 'index.html')) return false;

  try {
    const info = await stat(target);
    if (!info.isFile()) return false;
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, channelId: CHANNEL_ID, youtubeApiConfigured: Boolean(API_KEY) });
  }

  if (url.pathname === '/api/youtube/status') {
    try {
      const data = await getYoutubeStatus();
      return sendJson(res, 200, data, 'public, max-age=45, stale-while-revalidate=30');
    } catch (error) {
      const noKey = error.code === 'NO_API_KEY';
      return sendJson(res, noKey ? 503 : 502, {
        ok: false,
        channelId: CHANNEL_ID,
        isLive: false,
        latest: [],
        code: noKey ? 'NO_API_KEY' : 'YOUTUBE_API_ERROR',
        message: noKey
          ? 'Add YOUTUBE_API_KEY to .env for automatic live detection and latest videos.'
          : 'Unable to reach YouTube right now.'
      });
    }
  }

  if (await serveStatic(url.pathname, res)) return;

  // SPA-style fallback for clean links.
  if (!path.extname(url.pathname)) {
    const body = await readFile(path.join(publicDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(body);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MaskManUG site running at http://localhost:${PORT}`);
  console.log(`YouTube API configured: ${API_KEY ? 'yes' : 'no'}`);
});
