// Only a closed test child installs this callback. Never imported by production.
export function controlledBaseOpen(G,f) {
  if(typeof globalThis.__PB_SLOT43_OPEN!=='function')throw Error('CLOSED_TEST_OPEN_UNSET');
  return globalThis.__PB_SLOT43_OPEN(G,f);
}
