// Stands in for '@dimforge/rapier3d-compat' in the web build (see vite.config.ts).
//
// The compat package carries its WebAssembly as base64 text inside the JavaScript: ~4 MB
// that has to be downloaded, parsed and decoded before anything can start. The regular
// package ships the .wasm as its own file, which is smaller and which the browser compiles
// while it downloads. It's ready as soon as it's imported, so `init` has nothing to do.
// (Node scripts like `npm run check:physics` still use the compat package.)
import RAPIER from '@dimforge/rapier3d';

export default { ...RAPIER, init: async () => {} };
