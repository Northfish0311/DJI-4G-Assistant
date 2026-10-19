function createSerialQueue() {
  const waiting = [];
  let running = false;
  const drain = () => {
    if (running || !waiting.length) return;
    running = true;
    const entry = waiting.shift();
    clearTimeout(entry.timer);
    Promise.resolve().then(entry.task).then(entry.resolve, entry.reject).finally(() => {
      running = false;
      drain();
    });
  };
  return (task, {priority = 0, waitMs = 120000} = {}) => new Promise((resolve, reject) => {
    if (waiting.length >= 64) {
      reject(Object.assign(new Error("The serial queue is full. Try again after the current operation."), {code: "SERIAL_QUEUE_FULL"}));
      return;
    }
    const entry = {task, resolve, reject, priority, timer: null};
    entry.timer = setTimeout(() => {
      const index = waiting.indexOf(entry);
      if (index < 0) return;
      waiting.splice(index, 1);
      reject(Object.assign(new Error("The serial operation expired while waiting and was not executed."), {code: "SERIAL_QUEUE_TIMEOUT"}));
    }, waitMs);
    const position = waiting.findIndex(item => item.priority < priority);
    if (position < 0) waiting.push(entry);
    else waiting.splice(position, 0, entry);
    // Never interrupt an in-flight eUICC write. Urgent calls precede queued reads.
    drain();
  });
}

module.exports = { createSerialQueue };
