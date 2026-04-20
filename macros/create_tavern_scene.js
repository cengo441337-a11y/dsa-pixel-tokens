// DSA Pixel Tokens — Taverne-Szene erstellen
// Im Makro-Fenster ausfuehren (eines von beiden Bildern waehlen)

const variant = "v1"; // "v1" = zentrales Feuer kompakt | "v2" = Multi-Raum gross

const scene = await Scene.create({
  name: variant === "v1" ? "Taverne (klein)" : "Taverne (gross)",
  img: `modules/dsa-pixel-tokens/assets/scenes/tavern_${variant}.png`,
  width:  400,
  height: 400,
  padding: 0.1,
  background: { src: `modules/dsa-pixel-tokens/assets/scenes/tavern_${variant}.png` },
  grid: {
    type: 1,      // 1 = Quadrat-Grid
    size: 25,     // 25px pro Grid-Feld → 16x16 Felder auf 400x400
    color: "#ffffff",
    alpha: 0.15,
  },
  backgroundColor: "#000000",
  tokenVision: true,
  globalLight: true,   // erstmal alle sehen koennen, Vision/Licht spaeter fein-tunen
  darkness: 0,
});

await scene.activate();
ui.notifications.info(`Taverne "${scene.name}" erstellt und aktiviert.`);
