import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('sync detects live, sends exactly one push per new stream, and clears offline', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'maskmanug-sync-'));
  try {
    for (const folder of ['scripts', 'data']) await fs.mkdir(path.join(temp, folder));
    await fs.copyFile(path.join(root,'scripts','update-channel.mjs'),path.join(temp,'scripts','update-channel.mjs'));
    // module metadata for .mjs is independent of package.json
    await fs.copyFile(path.join(root,'tests','mock-fetch.mjs'),path.join(temp,'mock-fetch.mjs'));
    await fs.writeFile(path.join(temp,'config.json'),JSON.stringify({channelHandle:'@MaskManUG',oneSignalAppId:'demo-app-id'}));
    await fs.writeFile(path.join(temp,'data','channel.json'),JSON.stringify({configured:false,checkedAt:null,channel:{title:'MaskManUG',handle:'@MaskManUG',avatar:'',subscriberCount:null},live:null,videos:[]}));
    const notify = path.join(temp,'notify.txt');
    const run = async (live) => {
      const output = path.join(temp,'output.txt'); await fs.writeFile(output,'');
      const result = spawnSync('node', ['--import',path.join(temp,'mock-fetch.mjs'),path.join(temp,'scripts','update-channel.mjs')], {encoding:'utf8', env:{...process.env, YOUTUBE_API_KEY:'mock-key',ONESIGNAL_REST_API_KEY:'mock-push-key', MOCK_LIVE:live?'yes':'no',MOCK_NOTIFY_RECORD:notify,GITHUB_OUTPUT:output,GITHUB_REPOSITORY:'demo/maskmanug-website'}});
      assert.equal(result.status,0,result.stderr);
      return {snapshot:JSON.parse(await fs.readFile(path.join(temp,'data','channel.json'),'utf8')), changed:(await fs.readFile(output,'utf8')).includes('changed=true')};
    };
    const a = await run(true);
    assert.equal(a.snapshot.live?.id,'l1v2e3t4e5s'); assert.equal(a.changed,true); assert.equal(a.snapshot.videos.length,1);
    const b = await run(true); assert.equal(b.changed,false);
    const sent = (await fs.readFile(notify,'utf8')).trim().split('\n'); assert.equal(sent.length,1);
    const c = await run(false); assert.equal(c.snapshot.live,null); assert.equal(c.changed,true);
    assert.equal((await fs.readFile(notify,'utf8')).trim().split('\n').length,1);
  } finally { await fs.rm(temp,{recursive:true,force:true}); }
});
