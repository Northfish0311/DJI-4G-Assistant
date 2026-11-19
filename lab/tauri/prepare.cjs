const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),target=path.join(__dirname,'src-tauri/payload');
if(process.platform!=='win32'||process.arch!=='x64')throw Error('This payload requires Windows x64');
fs.mkdirSync(target,{recursive:true});
for(const item of ['web','scripts','tools','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md']){
  fs.cpSync(path.join(root,item),path.join(target,item),{recursive:true});
}
fs.copyFileSync(process.execPath,path.join(target,'node.exe'));
fs.copyFileSync(path.join(__dirname,'backend.cjs'),path.join(target,'backend.cjs'));
fs.mkdirSync(path.join(__dirname,'src-tauri/icons'),{recursive:true});
fs.copyFileSync(path.join(root,'build/icon.ico'),path.join(__dirname,'src-tauri/icons/icon.ico'));
const npm=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','npm ci --omit=dev --ignore-scripts --no-audit --no-fund'],{cwd:target,stdio:'inherit'});
if(npm.status!==0)process.exit(npm.status||1);
const removed=require('./prune-usb.cjs').pruneUsbPrebuilds(target);
console.log('USB prebuilds: kept win32-x64; removed '+removed.join(', '));
const probe=spawnSync(path.join(target,'node.exe'),['-e',"if(typeof require('usb').getDeviceList!=='function')process.exit(1)"],{cwd:target,stdio:'inherit'});
if(probe.status!==0)process.exit(probe.status||1);
