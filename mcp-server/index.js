#!/usr/bin/env node

/**
 * Foundry Local MCP Server
 *
 * Replaces the paid foundry-mcp.com bridge with a local WebSocket relay.
 *
 * Architecture:
 *   Claude (MCP stdio) <-> This Server <-> WebSocket <-> foundry-api-bridge module (browser)
 *
 * The foundry-api-bridge module connects to ws://localhost:3001/ws
 * and this server translates MCP tool calls into bridge commands.
 *
 * Setup:
 *   1. In Foundry's module settings for "Foundry API Bridge":
 *      - Set WebSocket URL to: ws://localhost:3001/ws
 *      - Set API Key to: local
 *   2. Run this server via MCP config
 */

import { WebSocketServer } from 'ws';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';
import { createServer } from 'http';

// ============================================================================
// Configuration
// ============================================================================
const WS_PORT = 3001;
const COMMAND_TIMEOUT_MS = 15000;

// ============================================================================
// Logging (to stderr so it doesn't interfere with MCP stdio on stdout)
// ============================================================================
function log(level, ...args) {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${level}] ${args.join(' ')}\n`);
}

// ============================================================================
// WebSocket Server — accepts connection from foundry-api-bridge module
// ============================================================================
let foundrySocket = null;
const pendingCommands = new Map(); // id -> { resolve, reject, timer }

// ============================================================================
// HTTP REST endpoint — allows direct eval calls from external scripts
// POST http://localhost:3002/eval  { "code": "..." }
// ============================================================================
const httpServer = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/eval') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { code } = JSON.parse(body);
        const result = await sendBridgeCommand('eval', { code });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connected: !!(foundrySocket && foundrySocket.readyState === 1) }));
  } else {
    res.writeHead(404); res.end('Not found');
  }
});
httpServer.listen(3002, '127.0.0.1', () => {
  log('INFO', 'HTTP eval endpoint listening on http://localhost:3002/eval');
});

const wss = new WebSocketServer({ port: WS_PORT, path: '/ws' });

wss.on('listening', () => {
  log('INFO', `WebSocket server listening on ws://localhost:${WS_PORT}/ws`);
  log('INFO', 'Waiting for Foundry API Bridge module to connect...');
  log('INFO', 'Set WebSocket URL in Foundry module settings to: ws://localhost:3001/ws');
  log('INFO', 'Set API Key to: local');
});

wss.on('connection', (ws, req) => {
  log('INFO', `Foundry bridge connected from ${req.socket.remoteAddress}`);
  foundrySocket = ws;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // Response from foundry-api-bridge: { id, success, data?, error? }
      if (msg.id && pendingCommands.has(msg.id)) {
        const pending = pendingCommands.get(msg.id);
        clearTimeout(pending.timer);
        pendingCommands.delete(msg.id);
        pending.resolve(msg);
      } else {
        log('DEBUG', 'Unmatched WS message:', JSON.stringify(msg).slice(0, 200));
      }
    } catch (e) {
      log('ERROR', 'Failed to parse WS message:', e.message);
    }
  });

  ws.on('close', () => {
    log('WARN', 'Foundry bridge disconnected');
    if (foundrySocket === ws) foundrySocket = null;
    // Reject all pending commands
    for (const [id, pending] of pendingCommands) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Foundry bridge disconnected'));
    }
    pendingCommands.clear();
  });

  ws.on('error', (err) => {
    log('ERROR', 'WebSocket error:', err.message);
  });
});

wss.on('error', (err) => {
  log('ERROR', 'WebSocket server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    log('ERROR', `Port ${WS_PORT} is already in use. Is another instance running?`);
    process.exit(1);
  }
});

/**
 * Send a command to the Foundry bridge and wait for the response.
 */
function sendBridgeCommand(type, params = {}) {
  return new Promise((resolve, reject) => {
    if (!foundrySocket || foundrySocket.readyState !== 1) {
      reject(new Error(
        'Foundry bridge is not connected. Make sure:\n' +
        '1. FoundryVTT is running on localhost:30000\n' +
        '2. The "Foundry API Bridge" module is enabled\n' +
        '3. WebSocket URL is set to ws://localhost:3001/ws\n' +
        '4. API Key is set to: local\n' +
        '5. A world is loaded (not just the setup screen)'
      ));
      return;
    }

    const id = randomUUID();
    const timer = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command "${type}" timed out after ${COMMAND_TIMEOUT_MS}ms`));
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(id, { resolve, reject, timer });

    const command = { id, type, params };
    foundrySocket.send(JSON.stringify(command));
  });
}

// ============================================================================
// MCP Tool Definitions
// ============================================================================

const TOOLS = [
  // --- World & Status ---
  {
    name: 'foundry_get_world',
    description: 'Get world info: system, actors, scenes, journals, compendiums overview.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },

  // --- Actors ---
  {
    name: 'foundry_list_actors',
    description: 'List all actors in the world. Returns IDs, names, types.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by type: "character", "npc", etc.' }
      },
      required: []
    }
  },
  {
    name: 'foundry_get_actor',
    description: 'Get full actor details: HP, AC, abilities, skills, speed, inventory summary.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' }
      },
      required: ['actorId']
    }
  },
  {
    name: 'foundry_get_actor_items',
    description: 'Get items from an actor inventory. Can filter by type, equipped, or usable.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        type: { type: 'string', description: 'Filter: weapon, equipment, consumable, spell, feat' },
        equipped: { type: 'boolean', description: 'Filter by equipped status' },
        hasActivities: { type: 'boolean', description: 'Filter to usable items only' }
      },
      required: ['actorId']
    }
  },
  {
    name: 'foundry_get_actor_effects',
    description: 'Get active effects on an actor (conditions, buffs, debuffs).',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' }
      },
      required: ['actorId']
    }
  },

  // --- Scenes ---
  {
    name: 'foundry_list_scenes',
    description: 'List all scenes with IDs, names, active status.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'foundry_get_scene',
    description: 'Get active scene details: tokens, grid, dimensions.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', description: 'Scene ID (omit for active scene)' }
      },
      required: []
    }
  },
  {
    name: 'foundry_get_scene_tokens',
    description: 'List tokens on a scene with positions, HP, AC, conditions.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', description: 'Scene ID (omit for active scene)' }
      },
      required: []
    }
  },
  {
    name: 'foundry_activate_scene',
    description: 'Switch the active scene. All players will see the new scene.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', description: 'Scene ID to activate' }
      },
      required: ['sceneId']
    }
  },

  // --- Journals ---
  {
    name: 'foundry_list_journals',
    description: 'List journal entries with IDs and names.',
    inputSchema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Filter by folder name' }
      },
      required: []
    }
  },
  {
    name: 'foundry_get_journal',
    description: 'Get a journal entry with all pages and content.',
    inputSchema: {
      type: 'object',
      properties: {
        journalId: { type: 'string', description: 'Journal ID' }
      },
      required: ['journalId']
    }
  },
  {
    name: 'foundry_create_journal',
    description: 'Create a new journal entry.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Journal name' },
        content: { type: 'string', description: 'Initial content (HTML)' },
        folder: { type: 'string', description: 'Folder ID' }
      },
      required: ['name']
    }
  },
  {
    name: 'foundry_update_journal_page',
    description: 'Update a journal page content.',
    inputSchema: {
      type: 'object',
      properties: {
        journalId: { type: 'string', description: 'Journal ID' },
        pageId: { type: 'string', description: 'Page ID' },
        content: { type: 'string', description: 'New content (HTML)' },
        name: { type: 'string', description: 'New page name' }
      },
      required: ['journalId', 'pageId']
    }
  },

  // --- Compendiums ---
  {
    name: 'foundry_list_compendiums',
    description: 'List available compendium packs (monsters, items, spells, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by type: Actor, Item, JournalEntry, Scene' }
      },
      required: []
    }
  },
  {
    name: 'foundry_get_compendium',
    description: 'Browse a compendium pack contents. Use search to filter by name.',
    inputSchema: {
      type: 'object',
      properties: {
        packId: { type: 'string', description: 'Pack ID, e.g. "dnd5e.monsters"' },
        search: { type: 'string', description: 'Filter by name (case-insensitive)' }
      },
      required: ['packId']
    }
  },

  // --- Rolling ---
  {
    name: 'foundry_roll_dice',
    description: 'Roll dice with a formula like "3d20", "2d6+5", "4d6kh3".',
    inputSchema: {
      type: 'object',
      properties: {
        formula: { type: 'string', description: 'Dice formula' },
        showInChat: { type: 'boolean', description: 'Show in Foundry chat (default: true)' },
        flavor: { type: 'string', description: 'Flavor text shown above roll' }
      },
      required: ['formula']
    }
  },
  {
    name: 'foundry_roll_skill',
    description: 'Roll a skill check for an actor. Skill keys: acr, ani, arc, ath, dec, his, ins, itm, inv, med, nat, prc, prf, per, rel, slt, ste, sur.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        skill: { type: 'string', description: 'Skill key (e.g. "prc" for Perception)' },
        showInChat: { type: 'boolean', description: 'Show in Foundry chat' }
      },
      required: ['actorId', 'skill']
    }
  },
  {
    name: 'foundry_roll_save',
    description: 'Roll a saving throw. Abilities: str, dex, con, int, wis, cha.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        ability: { type: 'string', description: 'Ability key (str, dex, con, int, wis, cha)' },
        showInChat: { type: 'boolean', description: 'Show in Foundry chat' }
      },
      required: ['actorId', 'ability']
    }
  },
  {
    name: 'foundry_roll_ability',
    description: 'Roll an ability check (no skill proficiency).',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        ability: { type: 'string', description: 'Ability key' },
        showInChat: { type: 'boolean', description: 'Show in Foundry chat' }
      },
      required: ['actorId', 'ability']
    }
  },
  {
    name: 'foundry_roll_attack',
    description: 'Roll an attack with a weapon or spell.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        itemId: { type: 'string', description: 'Weapon/spell item ID' }
      },
      required: ['actorId', 'itemId']
    }
  },
  {
    name: 'foundry_roll_damage',
    description: 'Roll damage for a weapon or spell.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        itemId: { type: 'string', description: 'Weapon/spell item ID' },
        critical: { type: 'boolean', description: 'Roll critical damage (double dice)' }
      },
      required: ['actorId', 'itemId']
    }
  },

  // --- Chat ---
  {
    name: 'foundry_chat',
    description: 'Send a message to Foundry VTT chat.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Message content (supports HTML)' },
        speaker: { type: 'string', description: 'Speaker display name' },
        actorId: { type: 'string', description: 'Speak as this actor (shows portrait)' },
        flavor: { type: 'string', description: 'Subheading text' },
        type: { type: 'string', enum: ['ic', 'ooc', 'emote'], description: 'Message style' },
        whisperTo: { type: 'array', items: { type: 'string' }, description: 'User IDs for whisper' }
      },
      required: ['content']
    }
  },

  // --- Actor CRUD ---
  {
    name: 'foundry_create_actor',
    description: 'Create a new actor (character, NPC, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Actor name' },
        type: { type: 'string', description: 'Actor type: character, npc, vehicle' },
        system: { type: 'object', description: 'System-specific data (HP, abilities, etc.)' },
        img: { type: 'string', description: 'Image path' }
      },
      required: ['name', 'type']
    }
  },
  {
    name: 'foundry_create_actor_from_compendium',
    description: 'Import an actor from a compendium (e.g. spawn a monster).',
    inputSchema: {
      type: 'object',
      properties: {
        packId: { type: 'string', description: 'Compendium pack ID' },
        actorId: { type: 'string', description: 'Actor ID within the compendium' },
        name: { type: 'string', description: 'Custom name (optional)' }
      },
      required: ['packId', 'actorId']
    }
  },
  {
    name: 'foundry_update_actor',
    description: 'Update actor properties: HP, name, abilities, etc. Use system paths like "attributes.hp.value".',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        name: { type: 'string', description: 'New name' },
        system: { type: 'object', description: 'System data to update, e.g. {"attributes":{"hp":{"value":25}}}' },
        img: { type: 'string', description: 'New image path' }
      },
      required: ['actorId']
    }
  },
  {
    name: 'foundry_delete_actor',
    description: 'Delete an actor from the world. Cannot be undone!',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID to delete' }
      },
      required: ['actorId']
    }
  },

  // --- Tokens ---
  {
    name: 'foundry_create_token',
    description: 'Place a token on the scene. Coordinates in pixels (gridCoord * gridSize).',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        x: { type: 'number', description: 'X position in pixels' },
        y: { type: 'number', description: 'Y position in pixels' },
        sceneId: { type: 'string', description: 'Scene ID (default: active scene)' },
        hidden: { type: 'boolean', description: 'Hide from players' }
      },
      required: ['actorId', 'x', 'y']
    }
  },
  {
    name: 'foundry_move_token',
    description: 'Move a token to new coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string', description: 'Token ID' },
        x: { type: 'number', description: 'New X in pixels' },
        y: { type: 'number', description: 'New Y in pixels' },
        animate: { type: 'boolean', description: 'Animate movement (default: true)' }
      },
      required: ['tokenId', 'x', 'y']
    }
  },
  {
    name: 'foundry_delete_token',
    description: 'Remove a token from the scene.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string', description: 'Token ID' },
        sceneId: { type: 'string', description: 'Scene ID (default: active)' }
      },
      required: ['tokenId']
    }
  },
  {
    name: 'foundry_update_token',
    description: 'Update token properties: position, visibility, elevation, rotation.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string', description: 'Token ID' },
        x: { type: 'number', description: 'X position' },
        y: { type: 'number', description: 'Y position' },
        hidden: { type: 'boolean', description: 'Visibility' },
        elevation: { type: 'number', description: 'Elevation' },
        rotation: { type: 'number', description: 'Rotation degrees' }
      },
      required: ['tokenId']
    }
  },

  // --- Combat ---
  {
    name: 'foundry_get_combat',
    description: 'Get current combat state: combatants, round, turn, initiative.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'foundry_create_combat',
    description: 'Create a new combat encounter.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string', description: 'Scene ID (default: active)' },
        activate: { type: 'boolean', description: 'Activate immediately (default: true)' }
      },
      required: []
    }
  },
  {
    name: 'foundry_add_combatant',
    description: 'Add an actor to combat.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        tokenId: { type: 'string', description: 'Token ID (if multiple tokens)' },
        initiative: { type: 'number', description: 'Pre-set initiative value' },
        hidden: { type: 'boolean', description: 'Hidden from players' }
      },
      required: ['actorId']
    }
  },
  {
    name: 'foundry_start_combat',
    description: 'Begin combat (round 1). Call after adding combatants and rolling initiative.',
    inputSchema: {
      type: 'object',
      properties: {
        combatId: { type: 'string', description: 'Combat ID (default: active)' }
      },
      required: []
    }
  },
  {
    name: 'foundry_next_turn',
    description: 'Advance to next combatant turn.',
    inputSchema: {
      type: 'object',
      properties: {
        combatId: { type: 'string', description: 'Combat ID (default: active)' }
      },
      required: []
    }
  },
  {
    name: 'foundry_previous_turn',
    description: 'Go back to previous combatant turn.',
    inputSchema: {
      type: 'object',
      properties: {
        combatId: { type: 'string', description: 'Combat ID (default: active)' }
      },
      required: []
    }
  },
  {
    name: 'foundry_roll_all_initiative',
    description: 'Roll initiative for all combatants at once.',
    inputSchema: {
      type: 'object',
      properties: {
        combatId: { type: 'string', description: 'Combat ID (default: active)' },
        npcsOnly: { type: 'boolean', description: 'Only roll for NPCs' }
      },
      required: []
    }
  },
  {
    name: 'foundry_end_combat',
    description: 'End and delete the active combat.',
    inputSchema: {
      type: 'object',
      properties: {
        combatId: { type: 'string', description: 'Combat ID (default: active)' }
      },
      required: []
    }
  },
  {
    name: 'foundry_set_combatant_defeated',
    description: 'Mark a combatant as defeated (skull icon, skip turns).',
    inputSchema: {
      type: 'object',
      properties: {
        combatantId: { type: 'string', description: 'Combatant ID (from get_combat)' },
        defeated: { type: 'boolean', description: 'true = defeated' }
      },
      required: ['combatantId', 'defeated']
    }
  },

  // --- Items ---
  {
    name: 'foundry_use_item',
    description: 'Use an item (potion, spell, weapon ability). Triggers Foundry automation.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        itemId: { type: 'string', description: 'Item ID' },
        consume: { type: 'boolean', description: 'Consume the item (default: true for consumables)' }
      },
      required: ['actorId', 'itemId']
    }
  },
  {
    name: 'foundry_activate_item',
    description: 'Activate an item with full automation (Midi-QOL, etc.). Use for attacks and spells with targets.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        itemId: { type: 'string', description: 'Item ID' },
        targetTokenIds: { type: 'array', items: { type: 'string' }, description: 'Target token IDs' },
        spellLevel: { type: 'integer', description: 'Spell slot level for upcasting' }
      },
      required: ['actorId', 'itemId']
    }
  },
  {
    name: 'foundry_add_item_to_actor',
    description: 'Create a custom item in an actor inventory.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        name: { type: 'string', description: 'Item name' },
        type: { type: 'string', description: 'Item type: weapon, equipment, consumable, spell, feat, loot' },
        system: { type: 'object', description: 'Item data: quantity, weight, damage, etc.' }
      },
      required: ['actorId', 'name', 'type']
    }
  },
  {
    name: 'foundry_add_item_from_compendium',
    description: 'Add an official item from a compendium to an actor.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        packId: { type: 'string', description: 'Compendium pack ID' },
        itemId: { type: 'string', description: 'Item ID in compendium' },
        quantity: { type: 'number', description: 'Quantity (default: 1)' }
      },
      required: ['actorId', 'packId', 'itemId']
    }
  },
  {
    name: 'foundry_update_actor_item',
    description: 'Update an item in an actor inventory (quantity, equipped, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        itemId: { type: 'string', description: 'Item ID' },
        name: { type: 'string', description: 'New name' },
        system: { type: 'object', description: 'Updated data' }
      },
      required: ['actorId', 'itemId']
    }
  },
  {
    name: 'foundry_delete_actor_item',
    description: 'Remove an item from actor inventory permanently.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        itemId: { type: 'string', description: 'Item ID' }
      },
      required: ['actorId', 'itemId']
    }
  },

  // --- Status Effects ---
  {
    name: 'foundry_toggle_status',
    description: 'Toggle a condition on an actor: blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        statusId: { type: 'string', description: 'Status ID (e.g. "blinded", "poisoned")' },
        active: { type: 'boolean', description: 'Explicit state (omit to toggle)' }
      },
      required: ['actorId', 'statusId']
    }
  },
  {
    name: 'foundry_add_effect',
    description: 'Add a custom active effect to an actor (buffs, debuffs, temporary modifiers).',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        name: { type: 'string', description: 'Effect name (e.g. "Bless")' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Data path (e.g. "system.attributes.ac.bonus")' },
              value: { type: 'string', description: 'Value (numbers as strings)' },
              mode: { type: 'number', description: '0=CUSTOM, 1=MULTIPLY, 2=ADD, 3=DOWNGRADE, 4=UPGRADE, 5=OVERRIDE' }
            }
          },
          description: 'Attribute changes'
        },
        duration: {
          type: 'object',
          properties: {
            rounds: { type: 'number' },
            seconds: { type: 'number' },
            turns: { type: 'number' }
          },
          description: 'Effect duration'
        },
        disabled: { type: 'boolean', description: 'Add but disabled' }
      },
      required: ['actorId', 'name']
    }
  },
  {
    name: 'foundry_remove_effect',
    description: 'Remove an active effect from an actor.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Actor ID' },
        effectId: { type: 'string', description: 'Effect ID (from get_actor_effects)' }
      },
      required: ['actorId', 'effectId']
    }
  },

  // --- Roll Tables ---
  {
    name: 'foundry_list_roll_tables',
    description: 'List all roll tables.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'foundry_roll_on_table',
    description: 'Roll on a table and get a random result.',
    inputSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Roll table ID' }
      },
      required: ['tableId']
    }
  },

  // --- Eval (power tool) ---
  {
    name: 'foundry_eval',
    description: 'Execute arbitrary JavaScript in the Foundry VTT browser context. Has access to game, canvas, ui, ChatMessage, Roll, and all Foundry APIs. Use for anything not covered by other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to execute. Return value will be sent back.' }
      },
      required: ['code']
    }
  }
];

// ============================================================================
// MCP Tool Name -> Bridge Command Mapping
// ============================================================================

/**
 * Maps MCP tool name to { bridgeType, paramMapper }.
 * paramMapper transforms MCP arguments to bridge params.
 */
const TOOL_MAP = {
  foundry_get_world:     { type: 'get-world-info',     params: () => ({}) },
  foundry_list_actors:   { type: 'get-actors',          params: (a) => a },
  foundry_get_actor:     { type: 'get-actor',           params: (a) => a },
  foundry_get_actor_items:  { type: 'get-actor-items',  params: (a) => a },
  foundry_get_actor_effects: { type: 'get-actor-effects', params: (a) => a },
  foundry_list_scenes:   { type: 'get-scenes-list',     params: () => ({}) },
  foundry_get_scene:     { type: 'get-scene',           params: (a) => a },
  foundry_get_scene_tokens: { type: 'get-scene-tokens', params: (a) => a },
  foundry_activate_scene: { type: 'activate-scene',     params: (a) => a },
  foundry_list_journals: { type: 'get-journals',        params: (a) => a },
  foundry_get_journal:   { type: 'get-journal',         params: (a) => a },
  foundry_create_journal: { type: 'create-journal',     params: (a) => a },
  foundry_update_journal_page: { type: 'update-journal-page', params: (a) => a },
  foundry_list_compendiums: { type: 'get-compendiums',  params: (a) => a },
  foundry_get_compendium: { type: 'get-compendium',     params: (a) => a },
  foundry_roll_dice:     { type: 'roll-dice',           params: (a) => ({ ...a, showInChat: a.showInChat ?? true }) },
  foundry_roll_skill:    { type: 'roll-skill',          params: (a) => a },
  foundry_roll_save:     { type: 'roll-save',           params: (a) => a },
  foundry_roll_ability:  { type: 'roll-ability',        params: (a) => a },
  foundry_roll_attack:   { type: 'roll-attack',         params: (a) => a },
  foundry_roll_damage:   { type: 'roll-damage',         params: (a) => a },
  foundry_chat:          { type: 'send-chat-message',   params: (a) => a },
  foundry_create_actor:  { type: 'create-actor',        params: (a) => a },
  foundry_create_actor_from_compendium: { type: 'create-actor-from-compendium', params: (a) => a },
  foundry_update_actor:  { type: 'update-actor',        params: (a) => a },
  foundry_delete_actor:  { type: 'delete-actor',        params: (a) => a },
  foundry_create_token:  { type: 'create-token',        params: (a) => a },
  foundry_move_token:    { type: 'move-token',          params: (a) => a },
  foundry_delete_token:  { type: 'delete-token',        params: (a) => a },
  foundry_update_token:  { type: 'update-token',        params: (a) => a },
  foundry_get_combat:    { type: 'get-combat-state',    params: () => ({}) },
  foundry_create_combat: { type: 'create-combat',       params: (a) => a },
  foundry_add_combatant: { type: 'add-combatant',       params: (a) => a },
  foundry_start_combat:  { type: 'start-combat',        params: (a) => a },
  foundry_next_turn:     { type: 'next-turn',           params: (a) => a },
  foundry_previous_turn: { type: 'previous-turn',       params: (a) => a },
  foundry_roll_all_initiative: { type: 'roll-all-initiative', params: (a) => a },
  foundry_end_combat:    { type: 'delete-combat',       params: (a) => a },
  foundry_set_combatant_defeated: { type: 'set-combatant-defeated', params: (a) => a },
  foundry_use_item:      { type: 'use-item',            params: (a) => a },
  foundry_activate_item: { type: 'activate-item',       params: (a) => a },
  foundry_add_item_to_actor: { type: 'add-item-to-actor', params: (a) => a },
  foundry_add_item_from_compendium: { type: 'add-item-from-compendium', params: (a) => a },
  foundry_update_actor_item: { type: 'update-actor-item', params: (a) => a },
  foundry_delete_actor_item: { type: 'delete-actor-item', params: (a) => a },
  foundry_toggle_status: { type: 'toggle-actor-status', params: (a) => a },
  foundry_add_effect:    { type: 'add-actor-effect',    params: (a) => a },
  foundry_remove_effect: { type: 'remove-actor-effect', params: (a) => a },
  foundry_list_roll_tables: { type: 'list-roll-tables', params: () => ({}) },
  foundry_roll_on_table: { type: 'roll-on-table',       params: (a) => a },
};

// ============================================================================
// MCP Protocol Handler (JSON-RPC over stdio)
// ============================================================================

const rl = createInterface({ input: process.stdin, terminal: false });
let inputBuffer = '';

rl.on('line', (line) => {
  inputBuffer += line;
  // Try to parse as complete JSON
  try {
    const msg = JSON.parse(inputBuffer);
    inputBuffer = '';
    handleMcpMessage(msg).catch(e => {
      log('ERROR', 'MCP handler error:', e.message);
    });
  } catch {
    // Incomplete JSON, wait for more lines
    // But actually MCP protocol sends one JSON per line, so reset on parse error
    inputBuffer = '';
    // Try just the current line
    try {
      const msg = JSON.parse(line);
      handleMcpMessage(msg).catch(e => {
        log('ERROR', 'MCP handler error:', e.message);
      });
    } catch {
      // Not valid JSON, ignore
    }
  }
});

function sendMcpResponse(response) {
  const json = JSON.stringify(response);
  process.stdout.write(json + '\n');
}

async function handleMcpMessage(msg) {
  const { jsonrpc, id, method, params } = msg;

  if (jsonrpc !== '2.0') {
    // Ignore non-JSON-RPC messages
    return;
  }

  switch (method) {
    case 'initialize':
      sendMcpResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'foundry-local-mcp',
            version: '1.0.0'
          }
        }
      });
      break;

    case 'notifications/initialized':
      // Client confirms initialization, no response needed
      break;

    case 'tools/list':
      sendMcpResponse({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS
        }
      });
      break;

    case 'tools/call':
      await handleToolCall(id, params);
      break;

    case 'ping':
      sendMcpResponse({ jsonrpc: '2.0', id, result: {} });
      break;

    default:
      // Unknown method
      if (id !== undefined) {
        sendMcpResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
      }
  }
}

async function handleToolCall(id, params) {
  const { name, arguments: args = {} } = params;

  // --- Special: foundry_eval (not a bridge command, but we simulate it via eval handler) ---
  if (name === 'foundry_eval') {
    try {
      // We send eval as a special command type that the bridge can handle
      // The bridge module doesn't have an eval handler, so we use a workaround:
      // We'll send arbitrary JS via ChatMessage or another mechanism
      // ACTUALLY: Let's add eval support by sending code wrapped as a command
      // The bridge doesn't have eval built in, but we can check if it's registered

      // Try sending as-is; if the bridge doesn't handle "eval", we'll get an error
      const result = await sendBridgeCommand('eval', { code: args.code });
      sendMcpResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: result.success
              ? JSON.stringify(result.data, null, 2)
              : `Error: ${result.error}`
          }]
        }
      });
    } catch (e) {
      sendMcpResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: `Error: ${e.message}\n\nNote: foundry_eval requires the bridge module to support the "eval" command type. ` +
                  `If it doesn't, you need to add an eval handler to the bridge module or use the specific tool commands instead.`
          }],
          isError: true
        }
      });
    }
    return;
  }

  // --- Standard tool -> bridge command mapping ---
  const mapping = TOOL_MAP[name];
  if (!mapping) {
    sendMcpResponse({
      jsonrpc: '2.0',
      id,
      error: { code: -32602, message: `Unknown tool: ${name}` }
    });
    return;
  }

  try {
    const bridgeParams = mapping.params(args);
    const result = await sendBridgeCommand(mapping.type, bridgeParams);

    if (result.success) {
      sendMcpResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(result.data, null, 2)
          }]
        }
      });
    } else {
      sendMcpResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: `Foundry error: ${result.error}`
          }],
          isError: true
        }
      });
    }
  } catch (e) {
    sendMcpResponse({
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: `Error: ${e.message}`
        }],
        isError: true
      }
    });
  }
}

// ============================================================================
// Graceful shutdown
// ============================================================================
process.on('SIGINT', () => {
  log('INFO', 'Shutting down...');
  wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('INFO', 'Shutting down...');
  wss.close();
  process.exit(0);
});

// Keep alive
log('INFO', 'Foundry Local MCP Server starting...');
log('INFO', 'MCP protocol on stdio, WebSocket relay on port ' + WS_PORT);
