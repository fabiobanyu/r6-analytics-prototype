'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
test('updater rebuilds verified cache offline, rejects corrupt sources, and retains snapshot on network failure',{timeout:45000},()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'r6-updater-test-'));
  try{
    for(const dir of ['data','scripts','src'])fs.cpSync(path.join(root,dir),path.join(temporary,dir),{recursive:true,filter:src=>!src.endsWith('.update.lock')});
    fs.copyFileSync(path.join(root,'index.html'),path.join(temporary,'index.html'));
    const command=process.env.PYTHON||'python';
    let run=spawnSync(command,['scripts/update_data.py','--offline','--detail-limit','0'],{cwd:temporary,encoding:'utf8',timeout:30000});
    assert.equal(run.status,0,run.stdout+run.stderr);
    const snapshot=path.join(temporary,'data/snapshot.json'),built=path.join(temporary,'index.html');
    const before=digest(snapshot),htmlBefore=digest(built);
    const parsed=JSON.parse(fs.readFileSync(snapshot,'utf8'));
    assert.equal(parsed.matches.length,JSON.parse(fs.readFileSync(path.join(root,'data/snapshot.json'),'utf8')).matches.length);
    run=spawnSync(command,['scripts/update_data.py','--force','--detail-limit','0'],{cwd:temporary,encoding:'utf8',timeout:15000,env:{...process.env,HTTP_PROXY:'http://127.0.0.1:1',HTTPS_PROXY:'http://127.0.0.1:1',NO_PROXY:''}});
    assert.equal(run.status,1,run.stdout+run.stderr);assert.equal(digest(snapshot),before);assert.equal(digest(built),htmlBefore);
    assert.equal(JSON.parse(fs.readFileSync(path.join(temporary,'data/update_status.json'),'utf8')).ok,false);
    const index=JSON.parse(fs.readFileSync(path.join(temporary,'data/cache_index.json'),'utf8'));
    fs.writeFileSync(path.join(temporary,'data',index['competition/502'].file),'corrupt TEST ONLY cache');
    run=spawnSync(command,['scripts/update_data.py','--offline'],{cwd:temporary,encoding:'utf8',timeout:10000});
    assert.equal(run.status,1,run.stdout+run.stderr);assert.equal(digest(snapshot),before);assert.equal(digest(built),htmlBefore);
  }finally{
    const resolved=path.resolve(temporary),prefix=path.resolve(os.tmpdir())+path.sep+'r6-updater-test-';
    if(!resolved.startsWith(prefix))throw Error('Unsafe temporary cleanup path');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
