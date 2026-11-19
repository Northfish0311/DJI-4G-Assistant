const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),readline=require('node:readline'),{once}=require('node:events');
const target=path.join(__dirname,'src-tauri/payload');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'dji-tauri-test-'));
 const child=spawn(path.join(target,'node.exe'),['backend.cjs'],{
   cwd:target,windowsHide:true,stdio:['pipe','pipe','pipe'],
   env:{...process.env,ROAMDOCK_DATA_ROOT:data,ALLOW_SMS_DELETE:'1',ALLOW_DANGEROUS_AT:'1'}
 });
 const stopped=once(child,'exit');
 const timeout=setTimeout(()=>child.kill(),30000);
 try{
  const output=readline.createInterface({input:child.stdout});
  const line=once(output,'line');child.stdin.write('START\n');
  const ready=JSON.parse((await Promise.race([line,stopped.then(()=>{throw Error('Backend exited before ready')})]))[0]);
  const base='http://127.0.0.1:'+ready.port;
  const h={'x-console-token':ready.token};
  const health=await fetch(base+'/api/health',{headers:h}).then(r=>r.json());
  assert.equal(health.ok,true);
  for(const [key,value] of Object.entries(health))if(key.endsWith('Enabled'))assert.equal(value,false,key);
  assert.equal((await fetch(base+'/api/euicc-inventory')).status,401);
  for(const resource of ['/','/sms.js','/euicc.js','/vendor/lucide.js'])assert.equal((await fetch(base+resource,{headers:h})).status,200,resource);
  child.stdin.end();assert.equal((await stopped)[0],0);
  await assert.rejects(fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)}));
  console.log('PASS: bundled backend, authentication, write flags disabled, assets, EOF shutdown. No modem reads.');
 } finally {clearTimeout(timeout);if(child.exitCode===null){child.kill();await stopped;}fs.rmSync(data,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
