#!/usr/bin/env node

/**
 * Patches the foundry-api-bridge module to add an eval handler.
 * Run this after updating the bridge module.
 *
 * Usage: node patch-bridge.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BRIDGE_PATH = join(
  process.env.LOCALAPPDATA || 'D:/Users/n0l3x/AppData/Local',
  'FoundryVTT/Data/modules/foundry-api-bridge/module.js'
);

const MARKER = '// === LOCAL MCP EVAL HANDLER';
const PATCH_ANCHOR = '  commandRouter.register("capture-scene", captureSceneHandler);';

const EVAL_HANDLER = `  commandRouter.register("capture-scene", captureSceneHandler);
  // === LOCAL MCP EVAL HANDLER (added by foundry-local-mcp) ===
  commandRouter.register("eval", async (params) => {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction(params.code);
    const result = await fn();
    // Serialize: if it's an object with toObject(), use that (Foundry documents)
    if (result && typeof result === 'object') {
      if (typeof result.toObject === 'function') return result.toObject();
      try { return JSON.parse(JSON.stringify(result)); } catch { return String(result); }
    }
    return result;
  });
  // === END LOCAL MCP EVAL HANDLER ===`;

try {
  const src = readFileSync(BRIDGE_PATH, 'utf-8');

  if (src.includes(MARKER)) {
    console.log('Eval handler already patched. Nothing to do.');
    process.exit(0);
  }

  if (!src.includes(PATCH_ANCHOR)) {
    console.error('Could not find patch anchor in module.js. The bridge module version may have changed.');
    console.error('Expected to find:', PATCH_ANCHOR);
    process.exit(1);
  }

  const patched = src.replace(PATCH_ANCHOR, EVAL_HANDLER);
  writeFileSync(BRIDGE_PATH, patched, 'utf-8');
  console.log('Successfully patched foundry-api-bridge with eval handler!');
  console.log('Reload Foundry VTT for changes to take effect.');
} catch (e) {
  console.error('Failed to patch:', e.message);
  process.exit(1);
}
