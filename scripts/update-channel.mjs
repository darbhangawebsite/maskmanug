/**
 * MaskManUG YouTube sync / live-alert publisher.
 * GitHub Action calls this every 20 minutes. No keys are exposed to the static site.
 * Any notification failure does not prevent publishing the latest live state.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config.json');
const dataPath = path.join(root, 'data', 'channel.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const previous = JSON.parse(await fs.readFile(dataPath, 'utf8'));
const apiKey = process.env.YOUTUBE_API_KEY;
const handle = String(config.channelHandle || '@MaskManUG').trim().replace(/^@*/, '@');
const githubRepository = process.env.GITHUB_REPOSITORY || '';
const [owner = '', repo = ''] = githubRepository.split('/');
const defaultSiteUrl = owner && repo
  ? `https://${owner.toLowerCase()}.github.io/${repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '' : `${repo}/`}`
  : 'https://example.com/';
const siteUrl = config.siteUrl || process.env.PUBLIC_SITE_URL || defaultSiteUrl;

if (!apiKey) {
  console.log('YOUTUBE_API_KEY GitHub secret is missing; retaining initial data.');
  process.exit(0);
}

async function yt(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set('key', apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(`YouTube ${endpoint} failed (${response.status}): ${result.error?.message || 'Unknown error'}`);
  return result;
}
function picture(channel) {
  const sources = channel?.snippet?.thumbnails || {};
  return sources.high?.url || sources.medium?.url || sources.default?.url || '';
}
function videoId(raw) { return typeof raw === 'string' && /^[\w-]{11}$/.test(raw) ? raw : null; }
async function notifyNewLive(live) {
  const key = process.env.ONESIGNAL_REST_API_KEY;
  const appId = config.oneSignalAppId;
  if (!key || !appId) { console.log('Push skipped: OneSignal credentials not configured.'); return; }
  try {
    const url = new URL('#watch', siteUrl).href;
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Key ${key}` },
      body: JSON.stringify({
        app_id: appId, target_channel: 'push', included_segments: ['Subscribed Users'],
        name: `MaskManUG live - ${live.id}`,
        headings: { en: '🔴 MASKMANUG IS LIVE!' },
        contents: { en: `Join the stream: ${live.title.slice(0, 140)}` },
        url, chrome_web_icon: new URL('icons/icon-192.png', siteUrl).href,
        data: { event: 'live', videoId: live.id },
        collapse_id: `maskmanug-live-${live.id}`
      }),
      signal: AbortSignal.timeout(20000)
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`OneSignal HTTP ${response.status}: ${body}`);
    console.log(`Live push request accepted: ${body.slice(0, 300)}`);
  } catch (error) { console.warn(`OneSignal delivery failed: ${error.message}`); }
}

try {
  const info = await yt('channels', { part: 'snippet,contentDetails,statistics', forHandle: handle });
  const channel = info.items?.[0];
  if (!channel?.id) throw new Error(`Channel not found for ${handle}; check config.json channelHandle.`);
  const channelId = channel.id;
  const uploadList = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadList) throw new Error('Channel uploads playlist is missing');

  // search.list with eventType=live detects current broadcasts (including those not on the uploads playlist).
  const liveSearch = await yt('search', { part: 'snippet', channelId, eventType: 'live', type: 'video', maxResults: 5 });
  const liveItem = (liveSearch.items || []).find(x => videoId(x?.id?.videoId));
  let live = liveItem ? {
    id: liveItem.id.videoId,
    title: liveItem.snippet?.title || 'MaskManUG live',
    startedAt: liveItem.snippet?.publishedAt || null
  } : null;
  // Public playlists from this channel. API key access never returns private lists.
  const publicLists = await yt('playlists', { part: 'snippet,contentDetails,status', channelId, maxResults: 50 });
  const playlists = (publicLists.items || [])
    .filter(x => x?.id && x.status?.privacyStatus !== 'private' && x.status?.privacyStatus !== 'unlisted')
    .filter(x => x.id !== uploadList && x.snippet?.title)
    .slice(0, 9).map(x => {
      const thumb = x.snippet?.thumbnails || {};
      return {
        id: x.id,
        title: x.snippet.title,
        thumbnail: thumb.maxres?.url || thumb.standard?.url || thumb.high?.url || thumb.medium?.url || thumb.default?.url || '',
        videoCount: Number(x.contentDetails?.itemCount || 0)
      };
    });
  const uploads = await yt('playlistItems', { part: 'snippet,contentDetails', playlistId: uploadList, maxResults: 12 });
  const items = (uploads.items || []).map(x => ({
    id: videoId(x.contentDetails?.videoId || x.snippet?.resourceId?.videoId),
    title: x.snippet?.title || '',
    publishedAt: x.contentDetails?.videoPublishedAt || x.snippet?.publishedAt || null
  })).filter(x => x.id && x.title && x.title !== 'Deleted video' && x.title !== 'Private video');
  const videoIds = [...new Set([...items.map(x => x.id), ...(live ? [live.id] : [])])];
  const videosResponse = videoIds.length ? await yt('videos', { part: 'snippet,contentDetails,liveStreamingDetails', id: videoIds.join(',') }) : { items: [] };
  const details = new Map((videosResponse.items || []).map(x => [x.id, x]));
  const videos = items.filter(x => details.has(x.id)).map(x => {
    const detail = details.get(x.id);
    return {
      id: x.id,
      title: detail.snippet?.title || x.title,
      publishedAt: detail.snippet?.publishedAt || x.publishedAt,
      kind: detail.liveStreamingDetails ? 'live' : 'video'
    };
  }).slice(0, 6);
  // search results can lag; verify returned video still has live status.
  if (live) {
    const selected = details.get(live.id);
    if (selected && selected.snippet?.liveBroadcastContent === 'none') live = null;
    else if (selected?.snippet?.title) live.title = selected.snippet.title;
  }
  const next = {
    configured: true,
    checkedAt: new Date().toISOString(),
    channel: {
      title: channel.snippet?.title || 'MaskManUG', handle,
      avatar: picture(channel),
      subscriberCount: channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount ?? NaN)
    },
    live,
    videos,
    playlists
  };
  if (!Number.isFinite(next.channel.subscriberCount)) next.channel.subscriberCount = null;
  const previousLiveId = previous.live?.id || null;
  // Do not commit every 20 minutes: only save a changed stream / video / channel snapshot.
  const oldComparison = { ...previous, checkedAt: null };
  const newComparison = { ...next, checkedAt: null };
  const changed = JSON.stringify(oldComparison) !== JSON.stringify(newComparison);
  await fs.writeFile(dataPath, JSON.stringify(next, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  }
  console.log(changed ? `Channel updated. live=${live?.id || 'none'}, videos=${videos.length}, playlists=${playlists.length}` : 'No content change; freshness timestamp updated for deployment only.');
  if (live && live.id !== previousLiveId) await notifyNewLive(live);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
