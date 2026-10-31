"use strict";
// Minimal shared state: did the sentence.js ESM module load successfully?
// Written by server.js, read by src/api.js (/api/health).
let _ready = false;
module.exports = {
  setShareReady(v) { _ready = !!v; },
  shareReady()    { return _ready; }
};
