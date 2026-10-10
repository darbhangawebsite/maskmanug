import fs from 'node:fs/promises';
const LIVE = process.env.MOCK_LIVE === 'yes';
const liveId = 'l1v2e3t4e5s';
const uploadId = 'a1b2c3d4e5F';
const json = x => ({ok:true,status:200,json:async()=>x,text:async()=>JSON.stringify(x)});
globalThis.fetch = async (target, options) => {
  const url = new URL(String(target));
  if (url.hostname === 'api.onesignal.com') {
    const request = JSON.parse(options.body);
    await fs.appendFile(process.env.MOCK_NOTIFY_RECORD, `${request.name}\n`);
    return json({id:'dummy-message'});
  }
  if (url.hostname !== 'www.googleapis.com') throw new Error(`Unexpected network access: ${url}`);
  if (url.pathname.endsWith('/channels')) return json({items:[{id:'UC000000000000000000000',snippet:{title:'MaskManUG',thumbnails:{high:{url:'https://example.com/avatar.jpg'}}},contentDetails:{relatedPlaylists:{uploads:'UU0011223344'}},statistics:{subscriberCount:'40000'}}]});
  if (url.pathname.endsWith('/search')) return json({items:LIVE?[{id:{videoId:liveId},snippet:{title:'LIVE GTA RP',publishedAt:'2026-10-08T09:00:00Z'}}]:[]});
  if (url.pathname.endsWith('/playlists')) return json({items:[{id:'PLmaskmanugGTA123',snippet:{title:'GTA RP Adventures',thumbnails:{high:{url:'https://i.ytimg.com/vi/a1b2c3d4e5F/hqdefault.jpg'}}},contentDetails:{itemCount:17},status:{privacyStatus:'public'}},{id:'PLmaskmanugPrivate',snippet:{title:'Hidden'},status:{privacyStatus:'private'}}]});
  if (url.pathname.endsWith('/playlistItems')) return json({items:[{contentDetails:{videoId:uploadId,videoPublishedAt:'2026-10-07T10:00:00Z'},snippet:{title:'Gorib Adventures'}}]});
  if (url.pathname.endsWith('/videos')) {
    return json({items:(url.searchParams.get('id')||'').split(',').map(id=>({id,snippet:{title:id===liveId?'LIVE GTA RP':'Gorib Adventures',publishedAt:'2026-10-07T10:00:00Z',liveBroadcastContent:id===liveId?'live':'none'},liveStreamingDetails:id===liveId?{actualStartTime:'2026-10-08T09:00:00Z'}:undefined}))});
  }
  throw new Error(`Unexpected YouTube endpoint ${url.pathname}`);
};
