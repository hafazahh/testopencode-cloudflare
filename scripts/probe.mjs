// probe: node version / sqlite availability
console.log('node version:', process.version);
try {
  const mod = require('node:sqlite');
  console.log('node:sqlite available:', mod);
} catch (e) {
  console.log('node:sqlite NOT available:', e.message);
}
console.log('global this:', typeof globalThis.structuredClone);
