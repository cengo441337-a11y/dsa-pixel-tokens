// DSA Makro: Feuerball
// Wirft einen Feuerball vom ausgewählten Token auf das Ziel-Token
// Auswahl: 1. Token auswählen (Zauberer), 2. Makro ausführen, Ziel anklicken

const caster = canvas.tokens.controlled[0];
if (!caster) return ui.notifications.warn("Keinen Token ausgewählt!");

// Ziel aus Targeting
const targets = [...game.user.targets];
if (targets.length === 0) return ui.notifications.warn("Kein Ziel markiert! (T drücken zum Zielen)");

const target = targets[0];
DSAPixelTokens.spawnProjectile(caster, target, "feuerball", "explosion");
