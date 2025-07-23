const listeners = new Map();

function on(evt, cb) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(cb);
}

function off(evt, cb) {
  if (listeners.has(evt)) listeners.get(evt).delete(cb);
}

function emit(evt, data) {
  if (!listeners.has(evt)) return;
  for (const cb of Array.from(listeners.get(evt))) {
    cb(data);
  }
}

export { on, off, emit };
