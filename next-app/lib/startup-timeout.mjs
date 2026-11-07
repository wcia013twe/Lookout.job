// Keep a stalled auth or setup request from trapping the user on a loading screen.
export function withStartupTimeout(promise, milliseconds = 12000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Workspace startup timed out')), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}
