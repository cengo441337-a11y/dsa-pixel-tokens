// DSA Makro: Effekt am Token
// Spielt einen Effekt direkt am ausgewählten Token ab
// Verfügbare Effekte: feuerball, explosion, eis, blitz, heilung, gift, schatten, wasser

const token = canvas.tokens.controlled[0];
if (!token) return ui.notifications.warn("Keinen Token ausgewählt!");

// Effekt hier ändern:
const effekt = "heilung"; // z.B. "blitz", "eis", "gift", "schatten"

DSAPixelTokens.spawnEffect(token.center.x, token.center.y, effekt);
