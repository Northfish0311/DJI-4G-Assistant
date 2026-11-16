const {execFile} = require("node:child_process");

function startReader(exe, args) {
  let child;
  const done = new Promise(resolve => {
    child = execFile(exe, args, {windowsHide:true, timeout:11000, maxBuffer:32768, encoding:"utf8"}, (err, stdout) => {
      resolve({ok:!err, text:err ? "" : stdout.trimEnd()});
    });
  });
  return {done, stop:() => child.kill()};
}

function createNoticeGate(queue, startWatch) {
  let watcher = null, owners = 0;
  return {
    serial(task, options) {
      owners++;
      const active = watcher;
      active?.stop();
      return queue(async () => { if (active) await active.done; return task(); }, options).finally(() => { owners--; });
    },
    watch(port) {
      if (owners || (watcher && watcher.port !== port)) return Promise.resolve({ok:true, text:""});
      if (watcher) return watcher.done;
      const job = startWatch(port);
      const current = {port, stop:job.stop};
      current.done = job.done.finally(() => { if (watcher === current) watcher = null; });
      watcher = current;
      return current.done;
    },
    stop() { watcher?.stop(); },
  };
}
module.exports = {startReader, createNoticeGate};
