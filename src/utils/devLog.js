const devMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('dev');

function devLog(...args) {
  if (devMode) console.log(...args);
}

export { devLog, devMode };
