/**
 * DSA Pixel-Art Tokens — Magie-System
 * Zauberprobe mit Spontanmodifikationen, AsP-Berechnung, Zone-Markierung
 */

import { MODULE_ID, SPELL_MODIFICATIONS, resolveProbe, checkCritical, calculateModifications, lookupSpellEffect, resolveActorAsP, SPELL_DAMAGE_MAP, rollSpellDamage, HIT_ZONE_TABLE, ZONE_LABELS, getWoundThresholds, BESCHWOERUNG_MISSLINGEN, BEHERRSCHUNG_MISSLINGEN, rollBeschwoerungMisslingen, relayActorUpdate, relayTokenUpdate, broadcastVFX, getLepStatus } from "./config.mjs";

/** Helper: LeP-Status-Flags eines Aktors lesen (Eisern, Zäher Hund, Selbstbeherrschung). */
function _getLepStatusFlags(actor) {
  const sys = actor?.system ?? {};
  const vorteile = sys.vorteile ?? {};
  const sfList = Array.isArray(sys.sf) ? sys.sf : Object.values(sys.sf ?? {}).map(v => v?.name ?? v);
  const _has = (raw, n) => Array.isArray(raw)
    ? raw.some(e => (typeof e === "string" ? e : e?.name ?? "").toLowerCase() === n.toLowerCase())
    : Object.keys(raw).some(k => k.toLowerCase() === n.toLowerCase());
  return {
    eisern: _has(vorteile, "Eisern") || sfList.some(s => s === "Eisern"),
    zaeherHund: _has(vorteile, "Zäher Hund") || _has(vorteile, "Zaeher Hund"),
    hoheSelbstbeherrschung: (Number(sys.talente?.Selbstbeherrschung?.value ?? 0) >= 12),
  };
}
import { castPandaemonium } from "./pandaemonium.mjs";
import { castFesselranken, castAugeDesLimbus, castSumpfstrudel } from "./zone-spells.mjs";
import { tryGardianumAbsorb, castGardianum, showGardianumDialog } from "./gardianum.mjs";

// ─── AsP-Kosten parsen ───────────────────────────────────────────────────────

/**
 * Parst den AsP-Kosten-String aus spells.json.
 * Gibt null zurück wenn die Kosten variabel/unbekannt sind — dann zeigt
 * der Dialog "?" und zieht keine AsP ab.
 *
 * Unterstützt:
 *   "8"          → 8
 *   "8 AsP"      → 8
 *   "2W6"        → würfelt sofort (Erwartungswert 7)
 *   "2W6+4"      → würfelt sofort
 *   "2W20"       → würfelt sofort
 *   alles andere → null (variabel, kein Abzug)
 */
function _parseAspKosten(kosten) {
  if (!kosten || kosten === "?") return null;
  const s = String(kosten).trim();
  // Würfelformel zuerst prüfen (vor parseInt, da "2W20" sonst als 2 fehlinterpretiert wird)
  // Formate: "2W20", "W6", "3W6+4", "2W6 AsP (...)"
  const m = s.match(/^(\d*)W(\d+)([+-]\d+)?/i);
  if (m) {
    const count  = parseInt(m[1] || "1");
    const sides  = parseInt(m[2]);
    const bonus  = parseInt(m[3] || "0");
    // Erwartungswert: count * (sides+1)/2 + bonus
    return Math.round(count * (sides + 1) / 2 + bonus);
  }
  // Einfache Zahl oder "N AsP" / "N AsP/SR" / "N + X AsP"
  const simple = parseInt(s, 10);
  if (!isNaN(simple)) return simple;
  return null; // variabel
}

// ─── Zauberprobe-Dialog mit Spontanmodifikationen ───────────────────────────

/**
 * Öffnet den vollständigen Zauber-Dialog mit allen Spontanmodifikationen.
 * Berechnet live die effektiven AsP-Kosten und Probe-Erschwernisse.
 *
 * @param {Actor} actor - Der Zaubernde
 * @param {object} spellData - { name, probe: [attr1,attr2,attr3], zfw, kosten, reichweite, ... }
 * @returns {Promise<{mod: number, aspCost: number, mods: object}|null>}
 */
export async function showSpellDialog(actor, spellData) {
  const sys = actor.system;
  // AsP-Kosten aus spellData.kosten parsen
  // Unterstützte Formate: "8", "8 AsP", "2W6", "2W6+4", variable → null
  const rawKosten = _parseAspKosten(spellData.kosten);

  // Repräsentation des Casters ermitteln (gdsa speichert in actor.system.Reps als Boolean-Flags)
  const reps = actor.system?.Reps ?? {};
  let rep = "gildenmagisch";
  if      (reps.elf)  rep = "elfisch";
  else if (reps.hex)  rep = "hexisch";
  else if (reps.dru)  rep = "druidisch";
  else if (reps.sch)  rep = "schelmisch";
  else if (reps.bor)  rep = "borbaradianisch";
  else if (reps.geo)  rep = "geoden";
  else if (reps.kri)  rep = "kristallomant";
  else if (reps.mag)  rep = "gildenmagisch";

  // Borbaradianer mit gildenmagischer Repräsentation: ZfP-Zuschläge halbiert (WdZ S.260)
  const borMitGildenmagisch = rep === "borbaradianisch" && !!reps.mag;
  // Schelm-MR-Schwelle (WdH S.76, WdZ S.327):
  //   OHNE Vorteil/SF: 0 (volle MR muss überwunden werden — wie alle anderen)
  //   Vorteil "Unbeschwertes Zaubern" (WdH S.76): 7
  //   SF "Lockeres Zaubern" (WdZ S.327, Voraus.: Unbeschwertes Zaubern): 12
  // Schwelle wird beim MR-Wurf abgezogen — was bleibt, wird als
  // Probe-Erschwernis appliziert.
  let schelmMrIgnore = 0;
  if (rep === "schelmisch") {
    const _sfRaw = sys?.sonderfertigkeiten ?? sys?.sf ?? [];
    const _vortRaw = sys?.vorteile ?? {};
    const _checkList = (raw, n) => {
      if (Array.isArray(raw)) return raw.some(e => (typeof e === "string" ? e : e?.name ?? "").toLowerCase() === n.toLowerCase());
      return Object.keys(raw).some(k => k.toLowerCase() === n.toLowerCase());
    };
    const _hasSF = (n) => _checkList(_sfRaw, n);
    const _hasVorteil = (n) => _checkList(_vortRaw, n);
    schelmMrIgnore = _hasSF("Lockeres Zaubern") ? 12
                    : (_hasVorteil("Unbeschwertes Zaubern") || _hasSF("Unbeschwertes Zaubern")) ? 7
                    : 0;
  }
  // Pakt-Mechanik: Actor-Flag mit Pakt-Daten (Domäne, GP-Pool).
  // Bei passendem Spruchmerkmal (Dämonisch X) wird Anrufung erleichtert
  // (3 Pakt-GP = -1 Erleichterung, max. -7).
  const aktorPakt = actor.getFlag(MODULE_ID, "pakt") ?? null;
  // Stimmt die Pakt-Domäne mit Spruchmerkmal überein?
  const spruchMerkmal = String(spellData.merkmal ?? "").toLowerCase();
  const paktDomaenePasst = aktorPakt && aktorPakt.domaene
    && spruchMerkmal.includes((aktorPakt.domaene || "").toLowerCase());
  const paktGpEinsatz = paktDomaenePasst ? Math.min(Math.floor((aktorPakt.gpPool ?? 0) / 3), 7) : 0;

  const extraFlags = { borMitGildenmagisch, schelmMrIgnore, paktDomaenePasst, paktGpEinsatz };

  // Repräsentations-spezifische Einschränkungen (WdZ S.21-22)
  const noErzwingen    = rep === "schelmisch";
  const noZDVerdoppeln = rep === "schelmisch" || rep === "borbaradianisch";

  // Elfisch: 1 AsP Rabatt bei augenblicklicher/permanenter Wirkungsdauer (WdZ S.322)
  const wirkungsdauer = (spellData.wirkungsdauer ?? "").toLowerCase();
  const elfAspDiscount = rep === "elfisch" && /augenblicklich|permanent/.test(wirkungsdauer) ? 1 : 0;
  // null = variable Kosten (kein Abzug, Dialog zeigt Rohstring)
  const variableKosten = rawKosten === null;
  const baseKosten = variableKosten ? null : Math.max(1, rawKosten - elfAspDiscount);

  // Elfisch: KL↔IN in Probe tauschbar (WdZ S.322)
  const probeArr = spellData.probe ?? [];
  const canElfSwap = rep === "elfisch" && probeArr.includes("KL") &&
    probeArr.filter(a => a === "IN").length < 2; // nicht alle 3 auf IN

  // ── Varianten-Dropdown (aus Liber Cantiones) ────────────────────────
  const varianten = spellData.varianten ?? [];
  const OPT = (val, text, disabled = false) =>
    `<option value="${val}" style="background:#0d1b2e;color:${disabled ? '#666' : '#e0e0e0'}" ${disabled ? 'disabled' : ''}>${text}</option>`;

  const variantenHtml = varianten.length > 0 ? (() => {
    const opts = [OPT("-1", "Keine Variante")];
    for (let i = 0; i < varianten.length; i++) {
      const v = varianten[i];
      const zfw = parseInt(spellData.zfw) || 0;
      const disabled = !!(v.minZfw && zfw < v.minZfw);
      const label = `${v.name} (${v.zfpKosten > 0 ? '+' : ''}${v.zfpKosten} ZfP${v.minZfw ? `, ab ZfW ${v.minZfw}` : ''})`;
      const aspHint = v.aspKosten ? ` | ${v.aspKosten}` : '';
      opts.push(OPT(i, label + aspHint + (disabled ? ' — ZfW zu niedrig' : ''), disabled));
    }
    return `
      <div style="font-family:'Press Start 2P',cursive;font-size:9px;color:#ffd700;margin:8px 0 4px">
        ZAUBERVARIANTE
      </div>
      <div class="mod-section">
        <select id="spell-variante" style="width:100%;background:#0d1b2e;color:#e0e0e0;border:2px solid #3a3a5e;color-scheme:dark">${opts.join('')}</select>
      </div>`;
  })() : "";

  // ── Effektive ZfP-Kosten pro Option (rep-spezifisch) ─────────────────
  const repZfpCost = (opt, modKey) => {
    let cost = opt.zfpCost ?? 0;
    // Elfisch: WD-Verdoppeln nur 4 ZfP (WdZ S.322)
    if (rep === "elfisch" && modKey === "wirkungsdauer" && opt.wdVerdoppelt) cost = 4;
    // Borbaradianisch: Reichweite +7 ZfP/Stufe (WdZ S.23)
    if (rep === "borbaradianisch" && opt.reichweiteSteps) cost = opt.reichweiteSteps * 7;
    // Kristallomantisch: alle Kosten ×2 (WdZ S.324)
    if (rep === "kristallomant" && cost > 0) cost = cost * 2;
    // Gildenmagisch / Borb+Gild: Kosten halbiert — Hinweis beim Total, nicht pro Option
    return cost;
  };

  // ── Modifikations-Selects (ZfP-basiert, WdZ-konform) ────────────────
  const modSections = Object.entries(SPELL_MODIFICATIONS).map(([key, mod]) => {
    if (key === "erzwingen" && noErzwingen) return "";
    const options = mod.options.map((opt, i) => {
      if (opt.zdVerdoppelt && noZDVerdoppeln) return "";
      const displayCost = repZfpCost(opt, key);
      const cost = displayCost ? `${displayCost} ZfP` : "";
      const extra = opt.extraAkt ? `+${opt.extraAkt} Akt` : "";
      const asp = opt.aspExtra ? `+${opt.aspExtra} AsP` : opt.aspMult && opt.aspMult !== 1.0 ? `×${opt.aspMult} AsP` : "";
      const zfpHalbiert = rep === "gildenmagisch" || borMitGildenmagisch;
      const erlVal = (opt.erleichterung ?? 0) + (opt.zdVerdoppelt && zfpHalbiert ? 1 : 0);
      const erl = erlVal ? `−${erlVal} Erschwer.` : "";
      const info = [cost, extra, asp, erl].filter(Boolean).join(", ");
      return OPT(i, `${opt.label}${info ? ` (${info})` : ""}`);
    }).join("");
    return `
      <div class="mod-section">
        <div class="mod-label">${mod.label} <span style="font-size:11px;color:#666">${mod.desc ?? ""}</span></div>
        <select data-mod="${key}" style="background:#0d1b2e;color:#e0e0e0;border:2px solid #3a3a5e;color-scheme:dark;width:100%">${options}</select>
      </div>`;
  }).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: `Zauber: ${spellData.name}`,
      content: `
        <div class="dsa-pixel-spell-dialog" style="color-scheme:dark">
          ${(() => {
            // Attributo & ähnliche: Probe enthält "*" als Platzhalter für die
            // dynamisch zu wählende Eigenschaft (z.B. KK bei KK-Steigerung).
            // Zeige Dropdown nur wenn der Spruch eine Wildcard-Eigenschaft hat.
            const hasWildcard = (spellData.probe ?? []).includes("*");
            if (!hasWildcard) return "";
            const attrs = ["MU","KL","IN","CH","FF","GE","KO","KK"];
            const opts = attrs.map(a => `<option value="${a}">${a}</option>`).join("");
            return `
            <div style="margin:6px 0;padding:6px 8px;background:rgba(180,140,80,0.10);border-left:3px solid #c9a;border-radius:0 4px 4px 0">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#fc9">
                <span>Wildcard-Eigenschaft (gesteigerte / Ziel):</span>
                <select id="probe-wildcard" style="background:#0d1b2e;color:#e0e0e0;border:2px solid #3a3a5e;color-scheme:dark">${opts}</select>
              </label>
              <div style="font-size:10px;color:#776;margin-top:2px;padding-left:8px">
                Bei Attributo: Probe-Eigenschaft = die gesteigerte Eigenschaft
              </div>
            </div>`;
          })()}
          <div class="spell-info">
            <div>
              <div class="info-label">Probe</div>
              <div class="info-value">${(spellData.probe ?? []).join("/")}</div>
            </div>
            <div>
              <div class="info-label">ZfW</div>
              <div class="info-value">${spellData.zfw}</div>
            </div>
            <div>
              <div class="info-label">Basis-AsP</div>
              <div class="info-value">${variableKosten ? `<span title="${spellData.kosten}" style="color:#ffd700">variabel</span>` : baseKosten}</div>
            </div>
            <div>
              <div class="info-label">Zauberdauer</div>
              <div class="info-value">${spellData.zauberdauer ?? "?"}</div>
            </div>
          </div>

          ${variantenHtml}

          <div style="font-family:'Press Start 2P',cursive;font-size:9px;color:#4a90d9;margin:8px 0 4px">
            SPONTANE MODIFIKATIONEN
          </div>

          ${modSections}

          ${canElfSwap ? `
          <div style="margin:6px 0;padding:6px 8px;background:rgba(0,180,120,0.1);border-left:3px solid #0b6;border-radius:0 4px 4px 0">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#9de">
              <input type="checkbox" id="elf-kl-in" style="margin:0;cursor:pointer">
              KL durch IN ersetzen (elfisch, WdZ S.322)
            </label>
          </div>` : ""}

          ${rep === "elfisch" ? `
          <div style="font-size:11px;color:#7a9;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;margin:4px 0">
            ✦ Elfisch: WD automatisch ×2 kostenlos · Misserfolg-Wdh. +5 (statt +3) · Antimagie ×2
            ${elfAspDiscount ? ` · −1 AsP (${wirkungsdauer})` : ""}
          </div>` : ""}

          ${rep === "schelmisch" ? (() => {
            const sfRaw = sys?.sonderfertigkeiten ?? sys?.sf ?? [];
            const hasSFSchelm = (n) => Array.isArray(sfRaw)
              ? sfRaw.some(e => (typeof e === "string" ? e : e?.name ?? "").toLowerCase() === n.toLowerCase())
              : Object.keys(sfRaw).some(k => k.toLowerCase() === n.toLowerCase());
            const mrIgnore = hasSFSchelm("Lockeres Zaubern") ? 12 : hasSFSchelm("Unbeschwertes Zaubern") ? 7 : 3;
            return `<div style="font-size:11px;color:#9b7;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;margin:4px 0">
              ✦ Schelmisch: MR bis ${mrIgnore} wird automatisch abgezogen · Mehrere Ziele: ×2 Opfer-Anzahl
            </div>`;
          })() : ""}

          ${rep === "kristallomant" ? `
          <div style="font-size:11px;color:#b9d;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:4px;margin:4px 0">
            ✦ Kristallomantisch: AsP ×¾ · Mods ×2 ZfP (ohne passende Kristalle)
          </div>` : ""}

          ${["hexisch","druidisch","geoden","kristallomant","schelmisch"].includes(rep) ? `
          <div style="margin:6px 0;padding:6px 8px;background:rgba(180,80,40,0.10);border-left:3px solid #b62;border-radius:0 4px 4px 0">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#fb9">
              <input type="checkbox" id="religious-violation" style="margin:0;cursor:pointer">
              Religiöse Bedingung verletzt (+12 ZfP, WdZ S.20)
            </label>
            <div style="font-size:10px;color:#776;margin-top:2px;padding-left:24px">
              Hexen ohne Bodenkontakt · Druiden mit Metall · Geoden ohne Element · Kristallomanten ohne Kristall
            </div>
          </div>` : ""}

          ${rep === "geoden" ? `
          <div style="margin:6px 0;padding:6px 8px;background:rgba(200,160,80,0.10);border-left:3px solid #ca8;border-radius:0 4px 4px 0">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#fc9">
              <input type="checkbox" id="geode-element" style="margin:0;cursor:pointer">
              Bevorzugtes Element + passende Merkmalskenntnis (−2 ZfP auf Einsparen/Reichweite/ZD, WdZ S.314)
            </label>
          </div>` : ""}

          ${(() => {
            // Aufrechterhaltene Zauber: WdZ S.13 — pro aktivem Spruch +3 Erschwernis
            const upkeep = actor.getFlag("dsa-pixel-tokens", "upkeepSpells") ?? 0;
            return `
            <div style="margin:6px 0;padding:6px 8px;background:rgba(80,140,180,0.10);border-left:3px solid #69b;border-radius:0 4px 4px 0">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#9be">
                <span>Aufrechterhaltene Zauber (+3 Erschwernis je):</span>
                <input id="upkeep-spells" type="number" min="0" value="${upkeep}" style="width:50px;text-align:center;background:#0d1b2e;border:2px solid #3a3a5e;color:#e0e0e0">
                <span style="font-size:10px;color:#779">WdZ S.13</span>
              </label>
            </div>`;
          })()}

          ${(() => {
            // Spruch wirkt gegen Magieresistenz (WdZ S.30): MR-Wert wird als
            // Erschwernis auf die Probe addiert. Wenn ein Token markiert ist,
            // ziehen wir die MR daraus automatisch. isMR-Flag aus spells.json,
            // Default false, User kann manuell aktivieren.
            // Plus: SF-Boni des Ziels gegen das Spruchmerkmal werden addiert
            // (Eiserner Wille +2/+4/+6 vs Einfluss, Gedankenschutz +1 vs Einfluss/Hellsicht).
            const isMRFlag = !!spellData.isMR;
            const targetToken = game.user?.targets?.first?.();
            const targetActor = targetToken?.actor;
            const baseMR = targetActor?.system?.MR?.value ?? 0;
            // Spruch-Merkmal aus spellData ableiten (z.B. "Einfluss", "Hellsicht").
            // spells.json speichert i.d.R. ein Merkmal-Array.
            const spellMerkmale = Array.isArray(spellData.merkmal)
              ? spellData.merkmal
              : (spellData.merkmal ? [spellData.merkmal] : (spellData.merkmale ?? []));
            // Ziel-SF-Boni-Map aus actor-flag holen
            const targetMRBonusByMerkmal = targetActor?.getFlag?.("dsa-pixel-tokens", "mrBonusByMerkmal") ?? {};
            // Boni je Merkmal aufsummieren wenn passend
            let mrSfBonus = 0;
            const matchedSfList = [];
            for (const merk of spellMerkmale) {
              const b = targetMRBonusByMerkmal[merk] ?? 0;
              if (b > 0) {
                mrSfBonus += b;
                matchedSfList.push(`+${b} vs ${merk}`);
              }
            }
            const targetMR = baseMR + mrSfBonus;
            const merkmaleStr = spellMerkmale.length > 0 ? spellMerkmale.join("/") : "—";
            return `
            <div style="margin:6px 0;padding:6px 8px;background:rgba(180,80,180,0.10);border-left:3px solid #b6b;border-radius:0 4px 4px 0">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#f9f">
                <input type="checkbox" id="vs-mr" ${isMRFlag ? "checked" : ""} style="margin:0;cursor:pointer">
                Spruch wirkt gegen MR (WdZ S.30) · Merkmale: ${merkmaleStr}
              </label>
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px;padding-left:24px;font-size:12px;color:#bbb">
                <span>Ziel-MR:</span>
                <input id="target-mr" type="number" min="0" value="${targetMR}" style="width:50px;text-align:center;background:#0d1b2e;border:2px solid #3a3a5e;color:#e0e0e0">
                ${targetToken ? `<span style="font-size:10px;color:#779">${targetToken.name}: MR ${baseMR}${mrSfBonus > 0 ? ` ${matchedSfList.join(", ")} = ${targetMR}` : ""}</span>` : `<span style="font-size:10px;color:#779">kein Token markiert</span>`}
              </div>
            </div>`;
          })()}

          ${(() => {
            // ── Beschwörungs-Block ───────────────────────────────────────
            // Wenn der Spruch eine Beschwörung ist (isBeschwoerung=true),
            // zeigen wir einen extra Block mit Wesen-Auswahl, Modifikatoren
            // und Hinweis auf die spätere Kontrollprobe.
            if (!spellData.isBeschwoerung) return "";
            const kategorie = spellData.beschwoerungKategorie ?? "?";

            // Wesen-Optionen je Kategorie
            const wesenOptions = (() => {
              if (kategorie === "elementar-geist") return [
                { label: "Elementargeist (BS+4 / BB+2 / 15 AsP)", bs: 4, bb: 2 },
              ];
              if (kategorie === "elementar-dschinn") return [
                { label: "Dschinn (BS+8 / BB+4 / 30 AsP)", bs: 8, bb: 4 },
              ];
              if (kategorie === "elementar-meister") return [
                { label: "Elementarer Meister (BS+12 / BB+8 / 50 AsP)", bs: 12, bb: 8 },
              ];
              if (kategorie === "daemon-nieder") return [
                // Beispiel-Werte aus Tractatus — User kann manuell anpassen
                { label: "Sharbazz (Belhalhar) — BS+6 / BB+2", bs: 6, bb: 2, basisAsp: 2 },
                { label: "Aphasmayras Atem — BS+12 / BB+8", bs: 12, bb: 8, basisAsp: 10 },
                { label: "Asqarath (Blakharaz) — BS+14 / BB+8", bs: 14, bb: 8, basisAsp: 16 },
                { label: "(Andere — manuell setzen)", bs: 0, bb: 0, basisAsp: 0 },
              ];
              if (kategorie === "daemon-gehoert") return [
                { label: "Arjunoor (Agrimoth) — BS+15 / BB+8", bs: 15, bb: 8, basisAsp: 30 },
                { label: "Arkhobal (Agrimoth) — BS+17 / BB+9", bs: 17, bb: 9, basisAsp: 30 },
                { label: "Balkha'bul (Tasfarelel) — BS+18 / BB+10", bs: 18, bb: 10, basisAsp: 30 },
                { label: "(Andere — manuell setzen)", bs: 0, bb: 0, basisAsp: 0 },
              ];
              if (kategorie === "untot-temporaer" || kategorie === "untot-permanent") return [
                { label: "Skelett (LO 9)", bs: 0, bb: 9 },
                { label: "Zombie (LO 12)", bs: 0, bb: 12 },
                { label: "Lebender Leichnam (LO 10)", bs: 0, bb: 10 },
                { label: "Mumie (LO 7)", bs: 0, bb: 7 },
                { label: "Tierkadaver (LO 12)", bs: 0, bb: 12 },
              ];
              if (kategorie === "golem-daemonisch") return [
                { label: "winzig/sehr klein (6W6 AsP)", bs: 3, bb: 6, basisAsp: 21 },
                { label: "klein (8W6 AsP)", bs: 0, bb: 6, basisAsp: 28 },
                { label: "mittel (12W6 AsP)", bs: 3, bb: 6, basisAsp: 42 },
                { label: "groß (16W6 AsP)", bs: 6, bb: 6, basisAsp: 56 },
                { label: "sehr groß (20W6 AsP)", bs: 9, bb: 6, basisAsp: 70 },
              ];
              if (kategorie === "golem-elementar") return [
                { label: "mittel (36 AsP)", bs: 0, bb: 6, basisAsp: 36 },
                { label: "groß (48 AsP)", bs: 3, bb: 6, basisAsp: 48 },
                { label: "sehr groß (120 AsP)", bs: 6, bb: 6, basisAsp: 120 },
              ];
              return [];
            })();

            const opts = wesenOptions.map((w, i) => `<option value="${i}" data-bs="${w.bs}" data-bb="${w.bb}" data-asp="${w.basisAsp || 0}">${w.label}</option>`).join("");
            return `
            <div style="margin:8px 0;padding:8px;background:rgba(180,40,40,0.10);border-left:3px solid #b44;border-radius:0 4px 4px 0">
              <div style="font-family:'Press Start 2P',cursive;font-size:9px;color:#f99;margin-bottom:4px">⛤ BESCHWÖRUNG (${kategorie})</div>
              <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#fbb;margin:4px 0">
                <span>Wesen:</span>
                <select id="beschw-wesen" style="flex:1;background:#0d1b2e;color:#e0e0e0;border:2px solid #3a3a5e;color-scheme:dark">${opts}</select>
              </label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:#caa;margin-top:4px">
                <label>Anrufungs-Erschwernis (BS): <input id="beschw-bs" type="number" value="0" style="width:50px;background:#0d1b2e;border:1px solid #3a3a5e;color:#e0e0e0;text-align:center"></label>
                <label>Beherrschungs-Erschwernis (BB): <input id="beschw-bb" type="number" value="0" style="width:50px;background:#0d1b2e;border:1px solid #3a3a5e;color:#e0e0e0;text-align:center"></label>
              </div>
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#caa;margin-top:4px">
                <input type="checkbox" id="beschw-no-name" style="margin:0">
                Ohne Wahren Namen (+7 Anrufung)
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#caa">
                Wahrer-Name-Qualität (Q1-7, erleichtert): <input id="beschw-name-qual" type="number" min="0" max="7" value="0" style="width:40px;background:#0d1b2e;border:1px solid #3a3a5e;color:#e0e0e0;text-align:center">
              </label>
              <div style="font-size:10px;color:#776;margin-top:4px;padding:3px 6px;background:rgba(0,0,0,0.3);border-radius:3px">
                ✦ Anrufungsprobe: ${(spellData.probe ?? []).join("/")} +BS+Modifikatoren<br>
                ✦ Kontrollprobe danach: 1W20 ≤ ${spellData.kontrollProbe ?? "(MU+MU+KL+CH+ZfW)/5"} −BB
              </div>
            </div>`;
          })()}

          <div style="display:flex;gap:12px;align-items:center;justify-content:center;margin:8px 0">
            <label style="font-size:14px;color:#bbb">Zusätzl. Mod:</label>
            <input id="spell-extra-mod" type="number" value="0" style="width:50px;text-align:center;font-size:18px;background:#0d1b2e;border:2px solid #3a3a5e;color:#e0e0e0">
          </div>

          <div class="cost-summary" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div>
              <div class="total-label">ZfP-Kosten:</div>
              <div class="probe-mod-display" id="spell-total-zfp" style="color:#e94560">0</div>
            </div>
            <div>
              <div class="total-label">Extra Aktionen:</div>
              <div class="probe-mod-display" id="spell-total-akt" style="color:#ffd700">+0</div>
            </div>
            <div>
              <div class="total-label">AsP-Kosten:</div>
              <div class="total-value" id="spell-total-asp">${variableKosten ? "variabel" : baseKosten}</div>
            </div>
          </div>
          <div style="text-align:center;font-size:12px;color:#888;margin-top:4px">
            Rep: ${rep}${elfAspDiscount ? ` · −1 AsP (${wirkungsdauer})` : ""}
          </div>
        </div>
      `,
      buttons: {
        cast: {
          icon: '<i class="fas fa-magic"></i>',
          label: "Zaubern!",
          callback: (html) => {
            const result = _calculateModificationsFromHTML(html, baseKosten, rep, varianten, extraFlags);
            resolve(result);
          },
        },
        cancel: { label: "Abbruch", callback: () => resolve(null) },
      },
      default: "cast",
      render: (html) => {
        const refresh = () => {
          const result = _calculateModificationsFromHTML(html, baseKosten, rep, varianten);
          html.find("#spell-total-zfp").text(result.totalZfP);
          html.find("#spell-total-akt").text(`+${result.extraAkt}`);
          html.find("#spell-total-asp").text(result.aspCost);
          html.find("#spell-total-zfp").css("color", result.totalZfP > 10 ? "#ff3333" : result.totalZfP > 0 ? "#e94560" : "#888");
        };
        html.find("select[data-mod], #spell-extra-mod, #spell-variante, #religious-violation, #geode-element, #upkeep-spells, #vs-mr, #target-mr, #probe-wildcard, #beschw-wesen, #beschw-bs, #beschw-bb, #beschw-no-name, #beschw-name-qual").on("input change", refresh);
      },
    }).render(true);
  });
}

function _calculateModificationsFromHTML(html, baseKosten, rep = "gildenmagisch", varianten = [], extraFlags = {}) {
  const selections = {};

  for (const key of Object.keys(SPELL_MODIFICATIONS)) {
    const select = html.find(`select[data-mod="${key}"]`);
    const idx = parseInt(select.val()) || 0;
    if (idx > 0) selections[key] = idx;
  }

  // ── Zusatz-Toggles aus dem Dialog auslesen ─────────────────────────────
  const religiousViolation = html.find("#religious-violation").prop("checked") ?? false;
  const geodeElement       = html.find("#geode-element").prop("checked") ?? false;
  const upkeepSpells       = parseInt(html.find("#upkeep-spells").val()) || 0;
  const vsMR               = html.find("#vs-mr").prop("checked") ?? false;
  const targetMR           = parseInt(html.find("#target-mr").val()) || 0;
  const probeWildcard      = html.find("#probe-wildcard").val() || "KK";

  // ── Pakt-Bonus (Pakt-GP einsetzen für passende Domäne) ─────────────────
  // extraFlags enthält paktGpEinsatz (auto-berechnet aus Pakt-Pool / Domäne)
  const paktBonus = extraFlags.paktGpEinsatz ?? 0;

  // ── Beschwörungs-Werte (Anrufung + spätere Kontrollprobe) ──────────────
  // Auto-Sync vom Wesen-Select: wenn User wechselt, BS/BB-Inputs füllen
  const beschwWesenSel = html.find("#beschw-wesen option:selected");
  if (beschwWesenSel.length) {
    // Werte aus data-Attributen ziehen, aber User-Override per Input erlaubt
    const dsBs  = parseInt(beschwWesenSel.attr("data-bs"))  || 0;
    const dsBb  = parseInt(beschwWesenSel.attr("data-bb"))  || 0;
    const userBs = parseInt(html.find("#beschw-bs").val());
    const userBb = parseInt(html.find("#beschw-bb").val());
    // Wenn User-Input unverändert (0), default aus selected option
    if (!userBs) html.find("#beschw-bs").val(dsBs);
    if (!userBb) html.find("#beschw-bb").val(dsBb);
  }
  const beschwBs       = parseInt(html.find("#beschw-bs").val()) || 0;  // Anrufungs-Erschwernis
  const beschwBb       = parseInt(html.find("#beschw-bb").val()) || 0;  // Beherrschungs-Erschwernis
  const beschwNoName   = html.find("#beschw-no-name").prop("checked") ?? false;
  const beschwNameQual = parseInt(html.find("#beschw-name-qual").val()) || 0;
  // Effektive Anrufungs-Erschwernis: BS + 7 wenn ohne Wahren Namen − Qualität
  const beschwAnrufungZuschlag = beschwBs + (beschwNoName ? 7 : 0) - beschwNameQual;
  // Effektive Beherrschungs-Erschwernis: BB − Qualität/3
  const beschwKontrollZuschlag = beschwBb - Math.floor(beschwNameQual / 3);

  // Schelm-MR-Schwelle berechnen (extraFlags.schelmMrIgnore wird in castSpell gesetzt)
  const schelmIgnore = extraFlags.schelmMrIgnore ?? 0;
  // Effektive MR-Erschwernis: bei rep=schelmisch reduziere um Schwelle
  const effectiveTargetMR = vsMR ? Math.max(0, targetMR - schelmIgnore) : 0;

  // Aufrechterhaltene Zauber: +3 pro aktivem Spruch (WdZ S.13)
  const upkeepErschwernis = upkeepSpells * 3;

  // Religiöse Bedingung verletzt: +12 ZfP (WdZ S.20)
  const religiousZfp = religiousViolation ? 12 : 0;

  // Geoden bevorzugtes Element: −2 ZfP auf kosten/reichweite/wirkungsdauer-Mods
  // (WdZ S.314). Wird unten als Korrektur auf totalZfP angewendet.
  let geodeReduction = 0;
  if (geodeElement && rep === "geoden") {
    if (selections.kosten)       geodeReduction += 2;
    if (selections.reichweite)   geodeReduction += 2;
    if (selections.wirkungsdauer)geodeReduction += 2;
  }

  // variable Kosten (null) → keine Modifikation durch Mods, aspCost bleibt null
  if (baseKosten === null) {
    const extraMod0 = parseInt(html.find("#spell-extra-mod").val()) || 0;
    const varIdx0 = parseInt(html.find("#spell-variante").val() ?? "-1");
    return {
      totalZfP: religiousZfp,
      extraAkt: 0,
      aspCost: null,
      // Erleichterung negativ = Erschwernis. MR + Aufrechterhaltene + Manueller Mod.
      erleichterung: -extraMod0 - effectiveTargetMR - upkeepErschwernis - beschwAnrufungZuschlag + paktBonus,
      selections, selectedVariant: varIdx0 >= 0 ? (varianten[varIdx0] ?? null) : null,
      elfKlInTausch: html.find("#elf-kl-in").prop("checked") ?? false,
      // Diagnostik / Display-Felder
      religiousViolation, geodeElement, upkeepSpells, vsMR, targetMR, effectiveTargetMR, probeWildcard,
      beschwAnrufungZuschlag, beschwKontrollZuschlag, beschwBs, beschwBb, beschwNoName, beschwNameQual,
    };
  }
  const result = calculateModifications(selections, baseKosten, rep, extraFlags);
  const extraMod = parseInt(html.find("#spell-extra-mod").val()) || 0;

  // Variante: ZfP-Zuschlag und zusätzliche AsP-Kosten addieren
  const varIdx = parseInt(html.find("#spell-variante").val() ?? "-1");
  const varZfp = (varIdx >= 0 && varianten[varIdx]) ? (varianten[varIdx].zfpKosten ?? 0) : 0;
  const selectedVariant = varIdx >= 0 ? (varianten[varIdx] ?? null) : null;
  // Varianten können eigene AsP-Kosten haben (aspKosten als Zahl oder String)
  let varAsp = 0;
  if (selectedVariant?.aspKosten) {
    const parsed = parseInt(selectedVariant.aspKosten);
    if (!isNaN(parsed)) varAsp = parsed;
  }

  const elfKlInTausch = html.find("#elf-kl-in").prop("checked") ?? false;

  return {
    totalZfP: Math.max(0, result.totalZfP + varZfp + religiousZfp - geodeReduction),
    extraAkt: result.totalExtraAkt,
    aspCost: result.finalAsP + varAsp,
    // Erleichterung neg = Erschwernis. Subtrahiere MR (mit Schelm-Reduktion),
    // Aufrechterhaltene Zauber und manuellen Mod von der Erleichterung.
    erleichterung: result.erleichterung - extraMod - effectiveTargetMR - upkeepErschwernis - beschwAnrufungZuschlag + paktBonus,
    selections,
    selectedVariant,
    elfKlInTausch,
    // Diagnostik / Display-Felder
    religiousViolation, geodeElement, upkeepSpells, vsMR, targetMR, effectiveTargetMR,
  };
}

// ─── Zauberprobe ausführen ──────────────────────────────────────────────────

/**
 * Führt eine vollständige Zauberprobe durch:
 * 1. Öffnet Modifikations-Dialog
 * 2. Würfelt 3W20
 * 3. Berechnet Ergebnis
 * 4. Zieht AsP ab
 * 5. Triggert VFX
 * 6. Bietet Zone-Markierung an (bei Zonenzaubern)
 */
export async function castSpell(actor, spellData) {
  // 1. Repräsentation des Casters (für rep-spezifische Regeln in castSpell)
  const repsC = actor.system?.Reps ?? {};
  let repC = "gildenmagisch";
  if      (repsC.elf)  repC = "elfisch";
  else if (repsC.hex)  repC = "hexisch";
  else if (repsC.dru)  repC = "druidisch";
  else if (repsC.sch)  repC = "schelmisch";
  else if (repsC.bor)  repC = "borbaradianisch";
  else if (repsC.geo)  repC = "geoden";
  else if (repsC.kri)  repC = "kristallomant";
  else if (repsC.mag)  repC = "gildenmagisch";

  // 2. Dialog
  const dialogResult = await showSpellDialog(actor, spellData);
  if (!dialogResult) return null;

  const { totalZfP, extraAkt, aspCost, erleichterung, selections, selectedVariant, elfKlInTausch, upkeepSpells, vsMR, targetMR, effectiveTargetMR, religiousViolation, geodeElement, probeWildcard, beschwAnrufungZuschlag, beschwKontrollZuschlag, beschwBs, beschwBb, beschwNoName, beschwNameQual } = dialogResult;

  // Aufrechterhaltene-Zauber-Counter persistieren (wird in nächstem Dialog
  // wieder vorbelegt). User kann Counter im Dialog jederzeit anpassen.
  if (typeof upkeepSpells === "number") {
    const currentFlag = actor.getFlag("dsa-pixel-tokens", "upkeepSpells") ?? 0;
    if (currentFlag !== upkeepSpells) {
      await actor.setFlag("dsa-pixel-tokens", "upkeepSpells", upkeepSpells);
    }
  }

  // 3. AsP prüfen (null = variable Kosten → kein automatischer Abzug)
  const aspData = resolveActorAsP(actor);
  const currentAsP = aspData?.val ?? 0;
  if (aspCost !== null && currentAsP < aspCost) {
    ui.notifications.warn(`Nicht genug AsP! Benötigt: ${aspCost}, Verfügbar: ${currentAsP}`);
    return null;
  }

  // 4. ZfP-Kosten vom ZfW abziehen (Spontanmodifikationen kosten ZfP, nicht Probe-Mod!)
  const baseZfw = parseInt(spellData.zfw) || 0;
  const effectiveZfw = baseZfw - totalZfP;
  if (effectiveZfw < 0) {
    ui.notifications.warn(`ZfW zu niedrig für diese Modifikationen! ZfW ${baseZfw} - ${totalZfP} ZfP = ${effectiveZfw}`);
    return null;
  }

  // 5. Würfeln
  const roll = new Roll("3d20");
  await roll.evaluate();
  const dice = roll.terms[0].results.map(r => r.result);

  // 5. Probe auswerten (Erleichterung aus Erzwingen wird als negativer Modifikator angewendet)
  const probeAttrs = (spellData.probe ?? []).map((a, idx) => {
    // Wildcard: Bei Sprüchen wie Attributo wird "*" durch die im Dialog
    // gewählte Eigenschaft ersetzt (z.B. KK für KK-Steigerung).
    let resolved = a;
    if (a === "*") resolved = probeWildcard || "KK";
    // Elfisch: KL kann durch IN ersetzt werden (WdZ S.322)
    if (elfKlInTausch && resolved === "KL") {
      const probe = spellData.probe ?? [];
      const inCount = probe.filter(x => x === "IN").length;
      const isFirstKl = probe.indexOf("KL") === idx;
      // Ersten KL durch IN ersetzen, wenn nicht alle 3 auf IN wären
      if (isFirstKl && (inCount + 1) < 3) {
        return actor.system["IN"]?.value ?? 10;
      }
    }
    return actor.system[resolved]?.value ?? 10;
  });
  const probeMod = -erleichterung; // Negativ = Erleichterung
  const result = resolveProbe(dice, probeAttrs, effectiveZfw, probeMod);
  const crit = checkCritical(dice);

  // 5. Ergebnis-Flags
  let success = result.success;
  let resultLabel, resultClass;

  if (crit.patzer) {
    success = false;
    resultLabel = "PATZER! Spruchstörung!";
    resultClass = "result-fail";
  } else if (crit.gluecklich) {
    success = true;
    resultLabel = "GLÜCKLICH! Maximale Wirkung!";
    resultClass = "result-crit";
  } else if (success) {
    resultLabel = "Gelungen";
    resultClass = "result-success";
  } else {
    resultLabel = "Misslungen";
    resultClass = "result-fail";
  }

  // 5a-Beschw. Misslungene Anrufung bei Beschwörungssprüchen → Misslingen-Tabelle
  // WdZ S.191: 2W6 + halbe BS (+ 7 ohne Wahren Namen, +5 bei Gehörnten, 3W6 bei Blutmagie)
  let anrufungMisslingen = null;
  if (!success && spellData.isBeschwoerung && !crit.gluecklich) {
    const isGehoernt = spellData.beschwoerungKategorie === "daemon-gehoert";
    const bsHalf = Math.floor((beschwBs || 0) / 2);
    let extraMod = 0;
    if (beschwNoName) extraMod += 7;
    if (isGehoernt)   extraMod += 5;
    anrufungMisslingen = rollBeschwoerungMisslingen(BESCHWOERUNG_MISSLINGEN, bsHalf, extraMod);
  }

  // 5b. Kontrollprobe für Beschwörungssprüche
  // DSA 4.1: Nach erfolgreicher Anrufung folgt die Kontrollprobe (1W20 ≤ Kontrollwert).
  //   Dämonen + Untote/Golem-dämonisch:  KontrollWert = (MU+MU+KL+CH+ZfW)/5
  //   Elementare:                         KontrollWert = (MU+IN+CH+CH+ZfW)/5
  //   Erschwernis: Beherrschungsschwierigkeit (BB) − Wahrer-Name-Qualität/3
  let kontrollResult = null;
  if (success && spellData.isBeschwoerung) {
    const sysAttr = (n) => actor.system?.[n]?.value ?? 10;
    const zfwNum = parseInt(spellData.zfw) || 0;
    // WdZ S.179: Kontrollwert-Formel pro Beschwörungs-Kategorie.
    // Robuste Detection per Kategorie-Lookup (vorher String-Match → fragil).
    const kategorie = (spellData.beschwoerungKategorie ?? "").toLowerCase();
    let kontrollWert;
    if (kategorie.startsWith("elementar")) {
      // Elementare: (MU+IN+CH+CH+ZfW)/5
      kontrollWert = Math.round((sysAttr("MU") + sysAttr("IN") + sysAttr("CH") + sysAttr("CH") + zfwNum) / 5);
    } else if (kategorie.startsWith("untot") || kategorie.startsWith("golem")) {
      // Untote / Golem (WdZ S.197): wie Dämonen
      kontrollWert = Math.round((sysAttr("MU") + sysAttr("MU") + sysAttr("KL") + sysAttr("CH") + zfwNum) / 5);
    } else {
      // Default Dämonen: (MU+MU+KL+CH+ZfW)/5
      kontrollWert = Math.round((sysAttr("MU") + sysAttr("MU") + sysAttr("KL") + sysAttr("CH") + zfwNum) / 5);
    }
    // Fallback: wenn beschwoerungKategorie nicht gesetzt, fallback zur kontrollFormula
    if (!kategorie && spellData.kontrollProbe?.includes("MU+IN+CH+CH")) {
      kontrollWert = Math.round((sysAttr("MU") + sysAttr("IN") + sysAttr("CH") + sysAttr("CH") + zfwNum) / 5);
    }
    const kontrollErschwernis = beschwKontrollZuschlag ?? 0;
    const kontrollTarget = kontrollWert - kontrollErschwernis;

    const kontrollRoll = new Roll("1d20");
    await kontrollRoll.evaluate();
    const kontrollDie = kontrollRoll.total;
    const kontrollSuccess = kontrollDie <= kontrollTarget && kontrollDie !== 20;
    kontrollResult = {
      die: kontrollDie,
      target: kontrollTarget,
      kontrollWert,
      erschwernis: kontrollErschwernis,
      success: kontrollSuccess,
      formula: kontrollFormula,
    };
    if (!kontrollSuccess) {
      // Beherrschung misslungen → Misslingen-Tabelle würfeln (WdZ S.191)
      // 2W6 + halbe BS, +5 bei Gehörnten
      const isGehoernt = spellData.beschwoerungKategorie === "daemon-gehoert";
      const bsHalf = Math.floor((beschwBs || 0) / 2);
      const extraMod = isGehoernt ? 5 : 0;
      const miss = rollBeschwoerungMisslingen(BEHERRSCHUNG_MISSLINGEN, bsHalf, extraMod);
      kontrollResult.misslingenWurf = miss;
      resultLabel = "Anrufung gelang — KONTROLLE MISSLUNGEN!";
      resultClass = "result-fail";
    } else {
      resultLabel = "Anrufung & Kontrolle gelungen";
    }
  }

  // 6. AsP abziehen — Hexisch: 1/3 bei Misserfolg (WdZ S.310); sonst: Hälfte (WdZ S.14)
  //    null = variable Kosten → kein Abzug, GM macht das manuell
  const failDivisor = repC === "hexisch" ? 3 : 2;
  const actualCost = aspCost === null ? null
    : success ? aspCost
    : Math.ceil(aspCost / failDivisor);
  if (aspData && actualCost !== null) {
    await actor.update({ [aspData.path]: Math.max(0, currentAsP - actualCost) });
  }

  // 7. Modifikations-Zusammenfassung (selections = { modKey: optionIndex })
  const modSummary = Object.entries(selections ?? {})
    .filter(([, idx]) => idx > 0)
    .map(([key, idx]) => {
      const mod = SPELL_MODIFICATIONS[key];
      const opt = mod?.options?.[idx];
      return opt ? `${mod.label}: ${opt.label}` : null;
    })
    .filter(Boolean)
    .join(", ");

  // 8. Chat
  // Probe-Labels für Chat (zeigt ersetztes Attribut an)
  const probeLabels = (spellData.probe ?? []).map((a, idx) => {
    if (a === "*") return `${probeWildcard || "KK"}*`;
    if (elfKlInTausch && a === "KL" && (spellData.probe ?? []).indexOf("KL") === idx) return "IN*";
    return a;
  });

  // Variante A (WdH S.27 / WdZ S.32): Würfel werden gegen unveränderte
  // Eigenschaft verglichen, Erschwernis kommt aus dem ZfW (effectiveZfw).
  const diceHtml = dice.map((d, i) => {
    const attr = probeAttrs[i];
    const cls = d === 1 ? "crit" : d === 20 ? "fumble" : d > attr ? "fail" : "success";
    return `<div class="die ${cls}" title="${probeLabels[i]} ${attr}">${d}</div>`;
  }).join("");

  const variantLine = selectedVariant
    ? `<div style="text-align:center;font-size:13px;color:#ffd700">Variante: ${selectedVariant.name}</div>`
    : "";

  // Beschwörungs-Block für Chat
  const kontrollLine = kontrollResult
    ? `<div style="margin-top:6px;padding:4px 6px;background:rgba(180,40,40,0.18);border-left:3px solid #b44;border-radius:3px;font-size:12px;color:#fbb">
         ⛤ Kontrollprobe: 1W20 = ${kontrollResult.die} ${kontrollResult.success ? "✓" : "✗"}
         (Ziel ${kontrollResult.target} = ${kontrollResult.kontrollWert} − ${kontrollResult.erschwernis} BB)
         <br><span style="color:#caa;font-size:10px">${kontrollResult.formula}</span>
         ${!kontrollResult.success ? `<br><b style="color:#ff6464">⚠ Wesen außer Kontrolle!</b>` : ""}
         ${kontrollResult.misslingenWurf ? `
           <div style="margin-top:3px;padding:3px 5px;background:rgba(255,0,0,0.15);border-radius:2px">
             <b>Beherrschungs-Misslingen ${kontrollResult.misslingenWurf.dieRolls.join("+")}+${kontrollResult.misslingenWurf.total - kontrollResult.misslingenWurf.sum} = ${kontrollResult.misslingenWurf.total}:</b>
             <br>${kontrollResult.misslingenWurf.entry?.effekt ?? "?"}
           </div>` : ""}
       </div>`
    : "";

  // Anrufungs-Misslingen für Beschwörung
  const anrufungMisslingenLine = anrufungMisslingen
    ? `<div style="margin-top:6px;padding:4px 6px;background:rgba(255,80,80,0.20);border-left:3px solid #f44;border-radius:3px;font-size:12px;color:#fcc">
         <b>⛤ Anrufungs-Misslingen ${anrufungMisslingen.dieRolls.join("+")}+${anrufungMisslingen.total - anrufungMisslingen.sum} = ${anrufungMisslingen.total} (WdZ S.191):</b>
         <br>${anrufungMisslingen.entry?.effekt ?? "?"}
         ${anrufungMisslingen.entry?.verfall ? `<br><b style="color:#f88">+${anrufungMisslingen.entry.verfall} Schleichender Verfall</b>` : ""}
       </div>`
    : "";

  // ZfP*-Aufschlüsselung: zeige effektiven ZfW + Modifikator-Abzüge transparent
  // an, damit User MR / Erschwernis-Abzüge nachvollziehen kann (WdH S.27).
  const probeModDisplay = probeMod || 0;
  const overSum = (result.details ?? []).reduce((s, d) => s + (d.consumed || 0), 0);
  const zfpBreakdownParts = [];
  if (totalZfP > 0) zfpBreakdownParts.push(`ZfW ${parseInt(spellData.zfw) || 0} − ${totalZfP} (Mod.)`);
  if (effectiveTargetMR > 0) zfpBreakdownParts.push(`− ${effectiveTargetMR} MR`);
  if (probeModDisplay !== 0 && effectiveTargetMR === 0) {
    if (probeModDisplay > 0) zfpBreakdownParts.push(`− ${probeModDisplay} Erschw.`);
    else                     zfpBreakdownParts.push(`+ ${-probeModDisplay} Erleicht.`);
  } else if (probeModDisplay - effectiveTargetMR !== 0) {
    const restMod = probeModDisplay - effectiveTargetMR;
    if (restMod > 0) zfpBreakdownParts.push(`− ${restMod} Erschw.`);
    else             zfpBreakdownParts.push(`+ ${-restMod} Erleicht.`);
  }
  if (success) zfpBreakdownParts.push(`− ${overSum} (über)`);
  const zfpBreakdownLine = (success && zfpBreakdownParts.length > 0)
    ? `<div style="text-align:center;font-size:10px;color:#779;margin-top:-4px">${zfpBreakdownParts.join(" ")} = ${result.tapStar}</div>`
    : "";

  // Misserfolg: zeige um wieviel verfehlt + Komplett-Breakdown
  let failureBreakdown = "";
  if (!success && !crit.patzer && !crit.gluecklich) {
    const missing = -result.remainder;
    const baseZfwNum = parseInt(spellData.zfw) || 0;
    const parts = [`ZfW ${baseZfwNum}`];
    if (totalZfP > 0)        parts.push(`− ${totalZfP} (Mod.)`);
    if (effectiveTargetMR>0) parts.push(`− ${effectiveTargetMR} MR`);
    const otherErschw = probeModDisplay - effectiveTargetMR;
    if (otherErschw > 0)     parts.push(`− ${otherErschw} Erschw.`);
    parts.push(`− ${overSum} (über)`);
    parts.push(`= ${result.remainder}`);
    failureBreakdown = `<div style="text-align:center;font-size:11px;color:#e94560;margin-top:2px"><b>${missing} Punkt${missing === 1 ? "" : "e"} verfehlt</b></div>
      <div style="text-align:center;font-size:10px;color:#779;margin-top:-2px">${parts.join(" ")}</div>`;
  }

  const flavor = `<div class="dsa-pixel-chat">
    <div class="chat-title">⚡ ${spellData.name}${spellData.isBeschwoerung ? " ⛤" : ""}</div>
    ${variantLine}
    <div class="dice-row">${diceHtml}</div>
    <div class="result-line ${resultClass}">${resultLabel}</div>
    ${success ? `<div class="tap-star">ZfP*: <span>${result.tapStar}</span></div>${zfpBreakdownLine}` : failureBreakdown}
    ${kontrollLine}
    ${anrufungMisslingenLine}
    <div style="text-align:center;font-size:13px;color:#4a90d9">
      ${actualCost === null
        ? `<span style="color:#ffd700">AsP: variabel — manuell abziehen! (${spellData.kosten})</span>`
        : `AsP: -${actualCost} ${!success ? `(${repC === "hexisch" ? "⅓" : "halbe"} Kosten)` : ""}`
      }
      ${modSummary ? `<br><span style="color:#888">${modSummary}</span>` : ""}
    </div>
    ${success && lookupSpellEffect(spellData.name)?.type === "zone" ?
      `<div class="chat-buttons">
        <button class="chat-btn" data-action="mark-zone" data-spell="${spellData.name}">
          ⬡ Zone markieren
        </button>
      </div>` : ""}
  </div>`;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
  });

  // 9. VFX auto-trigger (SPELL_EFFECT_MAP → Varianten → Keyword-Fallback)
  if (success && typeof DSAPixelTokens !== "undefined") {
    // Element-Variante kann Spruchnamen überschreiben (z.B. "Pfeil des (Elements)"
    // mit Variante "Pfeil der Luft" → mapping greift "Pfeil der Luft").
    const effectiveName = selectedVariant?.spellNameOverride || spellData.name;
    const mapping = lookupSpellEffect(effectiveName) || lookupSpellEffect(spellData.name);
    if (mapping && !mapping.enchantArrow) {
      _triggerSpellEffect(actor, mapping, spellData);
    }
    // Pfeil-Verzauberung: nächster Fernkampf-Schuss (Bogen/Armbrust/etc.)
    // wird mit dem Element-VFX abgefeuert. Sheet konsumiert den Eintrag.
    if (mapping?.enchantArrow) {
      globalThis.DSAPixelArrowEnchants ??= new Map();
      globalThis.DSAPixelArrowEnchants.set(actor.id, {
        effect:    mapping.effect,
        impact:    mapping.impact,
        label:     mapping.label,
        color:     mapping.color,
        spellName: effectiveName,
        // ZfP* × 10 KR Wirkungsdauer: für Anzeige, Cleanup nicht nötig
        // weil Verzauberung sowieso nur 1 Schuss hält.
        zfpStar:   result.tapStar ?? 1,
      });
      ui.notifications.info(
        `✨ ${mapping.label} bereit — nächster Fernkampf-Schuss fliegt verzaubert!`,
        { permanent: false }
      );
      // Sheet re-render damit "Verzauberte Pfeile"-Anzeige aktualisiert
      if (actor.sheet?.rendered) actor.sheet.render(false);
    }
  }

  // 10. Patzer-VFX
  if (crit.patzer && typeof DSAPixelTokens !== "undefined") {
    const token = actor.getActiveTokens()[0];
    if (token) {
      DSAPixelTokens.spawnEffect(token.center.x, token.center.y, "schadenflash");
    }
  }

  // 11a. Spezial-Zauber mit eigenem Ablauf (Zone/Duration)
  if (success && !crit.patzer) {
    const spellLow = spellData.name.toLowerCase();
    if (/pandaemonium|pandämonium/.test(spellLow)) {
      const borVariant = /borbaradian/.test(spellLow) || spellData.rep === "borbaradianisch";
      await castPandaemonium(actor, spellData, result.tapStar ?? 0, borVariant);
      return { success, result, crit, aspCost: actualCost };
    }
    if (/fesselranken/.test(spellLow)) {
      const dornen = /dornen/.test(spellLow);
      const stabil = /stabil/.test(spellLow);
      await castFesselranken(actor, spellData, result.tapStar ?? 0, { dornen, stabil });
      return { success, result, crit, aspCost: actualCost };
    }
    if (/auge.*limbus|limbusauge/.test(spellLow)) {
      await castAugeDesLimbus(actor, spellData, result.tapStar ?? 0, { radius: 3 });
      return { success, result, crit, aspCost: actualCost };
    }
    if (/sumpfstrudel|sumpf-strudel/.test(spellLow)) {
      const erdranken = /erdranken/.test(spellLow);
      await castSumpfstrudel(actor, spellData, result.tapStar ?? 0, { radius: 3, erdranken });
      return { success, result, crit, aspCost: actualCost };
    }
    if (/^gardianum/i.test(spellData.name) || /gardianum/i.test(spellLow)) {
      // Variante aus dem Namen inferieren — sonst Dialog
      const nameLow = spellData.name.toLowerCase();
      let variant = "base";
      if (/daemon|dämon/.test(nameLow))        variant = "daemonen";
      else if (/zauber/.test(nameLow))         variant = "zauber";
      else if (/persoenlich|persönlich/.test(nameLow)) variant = "persoenlich";

      // Dialog fuer AsP-Invest (ZfP* kommt aus der Probe)
      const zfpStar = result.tapStar ?? 0;
      return new Promise((resolve) => {
        new Dialog({
          title: `🛡 Gardianum — ${actor.name}`,
          content: `<form>
            <div style="margin:6px 0">
              <label>Variante:</label>
              <select name="variant" style="width:100%">
                <option value="base" ${variant==="base"?"selected":""}>Grund-Gardianum</option>
                <option value="daemonen" ${variant==="daemonen"?"selected":""}>Schild gegen Daemonen (+3 AsP, ZfW 7+)</option>
                <option value="zauber" ${variant==="zauber"?"selected":""}>Schild gegen Zauber (+3 AsP, ZfW 7+)</option>
                <option value="persoenlich" ${variant==="persoenlich"?"selected":""}>Persoenlicher Schild (+5 AsP, ZfW 11+)</option>
              </select>
            </div>
            <div style="margin:6px 0">
              <label>AsP investieren (min. 3):</label>
              <input type="number" name="aspInvest" value="6" min="3" style="width:100%">
            </div>
            <div style="margin:6px 0;padding:6px;background:rgba(74,144,217,0.1);border-radius:3px;font-size:11px;color:#888">
              ZfP* aus Probe: <strong>${zfpStar}</strong><br>
              Schild = AsP + 2×ZfP* (Persönlich: 3×ZfP* + AsP)
            </div>
          </form>`,
          buttons: {
            cast: {
              label: "Wirken",
              callback: async (html) => {
                const v = html.find('[name="variant"]').val();
                const asp = Number(html.find('[name="aspInvest"]').val() || 3);
                await castGardianum(actor, { variant: v, aspInvest: asp, zfpStar, spellName: spellData.name });
                resolve({ success, result, crit, aspCost: actualCost });
              },
            },
            cancel: { label: "Abbrechen", callback: () => resolve({ success, result, crit, aspCost: actualCost }) },
          },
          default: "cast",
        }).render(true);
      });
    }
  }

  // 11b. Schaden bei Zaubern mit Merkmal "Schaden" — Auto-Abzug auf Ziel
  if (success && !crit.patzer) {
    const damageInfo = _lookupSpellDamageFuzzy(spellData.name);
    if (damageInfo) {
      await _applySpellDamage(actor, spellData, damageInfo, actualCost ?? 0, result.tapStar ?? 0);
    }
  }

  return { success, result, crit, aspCost: actualCost };
}

// ─── Schadens-Zauber: Lookup mit Fuzzy-Match ────────────────────────────────

function _lookupSpellDamageFuzzy(spellName) {
  if (!spellName) return null;
  if (SPELL_DAMAGE_MAP[spellName]) return SPELL_DAMAGE_MAP[spellName];
  const lower = spellName.toLowerCase();
  // Erstes Wort matchen (z.B. "IGNIFAXIUS" matched "Ignifaxius Flammenstrahl")
  const firstWord = lower.split(/\s+/)[0];
  for (const [key, val] of Object.entries(SPELL_DAMAGE_MAP)) {
    if (key.split(/\s+/)[0].toLowerCase() === firstWord) return val;
  }
  // Substring-Match: z.B. "Feuerball" alleine matched "Ignisphaero Feuerball"
  for (const [key, val] of Object.entries(SPELL_DAMAGE_MAP)) {
    const keyLow = key.toLowerCase();
    // Jedes Wort des Map-Keys gegen den Spruch-Namen vergleichen
    const keyWords = keyLow.split(/\s+/);
    if (keyWords.some(w => w.length >= 4 && lower.includes(w))) return val;
  }
  return null;
}

// ─── Schaden auf Ziel anwenden (Auto-LeP + Wunden + Immunitaet) ─────────────

async function _applySpellDamage(caster, spellData, damageInfo, alreadyPaidAsP, zfpStar) {
  // Ziel pruefen
  const targetToken = [...(game.user?.targets ?? [])][0];
  if (!targetToken && damageInfo.needsTarget !== false) {
    ui.notifications.warn(`${spellData.name}: Kein Ziel markiert — Schaden wird nicht angewendet.`);
    return;
  }
  const targetActor = targetToken?.actor;

  // ── Flächenschaden (Ignisphaero/Feuerball etc.) ────────────────────────
  // Wenn damageInfo.aoeRadius gesetzt ist, treffen wir alle Tokens im Radius
  // und wenden den Schaden pro Token mit Distanz-Falloff an.
  if (damageInfo.aoeRadius && targetToken) {
    return _applyAoESpellDamage(caster, spellData, damageInfo, alreadyPaidAsP, zfpStar, targetToken);
  }

  // ZfW des Zauberers
  const zfw = Number(
    actorFindSkill(caster, spellData.name)?.value ??
    spellData.zfw ?? 0
  );

  // Max AsP = aktuelle AsP des Zauberers + bereits bezahlte (falls Formel mehr will)
  const aspData = resolveActorAsP(caster);
  const currentAsP = aspData?.val ?? 0;
  const aspMax = currentAsP + (alreadyPaidAsP || 0);

  // Schaden wuerfeln (inkl. ZfP* fuer fixedPlusZfpStar / dotPerKR)
  const dmg = await rollSpellDamage(spellData.name, damageInfo, {
    zfw,
    zfpStar: zfpStar || 0,
    aspMax,
    aspBaseCost: alreadyPaidAsP || 0,
  });
  if (!dmg) return; // Abbruch

  // Zusaetzliche AsP-Kosten (falls chooseDice/aspDice mehr kostet als bereits bezahlt)
  const extraAsP = Math.max(0, dmg.aspCost - (alreadyPaidAsP || 0));
  if (extraAsP > 0 && aspData?.path) {
    const newAsP = Math.max(0, currentAsP - extraAsP);
    await caster.update({ [aspData.path]: newAsP });
  }

  // Elementare Immunitaet pruefen (nimmt evt. geaendertes Element aus Variante)
  const effectiveElement = dmg.element ?? damageInfo.element;
  let immunity = _checkElementalImmunity(targetActor, effectiveElement);
  let tp = dmg.tp;
  if (immunity.immune) tp = 0;
  else if (immunity.resistant) tp = Math.floor(tp / 2);
  else if (immunity.vulnerable) tp = Math.floor(tp * 1.5);

  // Gardianum-Absorption VOR RS/LeP — Schild schluckt TP direkt (LCR S.97)
  let gardianumNote = "";
  if (tp > 0) {
    const absorb = await tryGardianumAbsorb(targetActor, targetToken, damageInfo, tp, spellData.name);
    if (absorb.absorbedTP > 0) {
      tp = absorb.remainingTP;
    }
    gardianumNote = absorb.note || "";
  }

  // Trefferzone (falls nicht Flaechenschaden)
  let hitZone = null, hitZoneLabel = "";
  if (!damageInfo.ignoreZones) {
    const zoneRoll = new Roll("1d20");
    await zoneRoll.evaluate();
    hitZone = HIT_ZONE_TABLE[zoneRoll.total] ?? "brust";
    hitZoneLabel = ZONE_LABELS[hitZone] ?? hitZone;
  }

  // RS des Ziels — inkl. perTenTpRSReduction (FAXIUS-Regel: pro 10 TP -1 RS)
  let targetRS = 0;
  let rsReductionNote = "";
  if (!damageInfo.ignoresRS && tp > 0) {
    targetRS = _getTargetRS(targetActor, hitZone);
    if (damageInfo.perTenTpRSReduction && targetRS > 0) {
      const reduction = Math.floor(tp / 10);
      if (reduction > 0) {
        const before = targetRS;
        targetRS = Math.max(0, targetRS - reduction);
        rsReductionNote = `<div style="color:#c09040;font-size:11px">⚠ Pro 10 TP −1 RS: ${before}→${targetRS}</div>`;
      }
    }
  }

  const sp = Math.max(0, tp - targetRS);

  // LeP oder AuP abziehen
  let resourceLine = "";
  if (damageInfo.onlyAuP) {
    const oldAuP = targetActor.system?.AuP?.value ?? 0;
    const newAuP = Math.max(0, oldAuP - sp);
    await relayTokenUpdate(targetToken, { "system.AuP.value": newAuP });
    resourceLine = `💤 ${targetActor.name}: ${oldAuP} → <strong style="color:#ff9800">${newAuP}</strong> AuP`;
  } else if (sp > 0) {
    const oldLeP = targetActor.system?.LeP?.value ?? 0;
    const newLeP = Math.max(0, oldLeP - sp);
    await relayTokenUpdate(targetToken, { "system.LeP.value": newLeP });
    // WdS S.78: getLepStatus() berücksichtigt Eisern/Zäher Hund/Selbstbeherrschung
    const lepFlags = _getLepStatusFlags(targetActor);
    const lepStatus = getLepStatus(newLeP, targetActor.system?.KO?.value ?? 10, lepFlags);
    const status = lepStatus.label
      ? `<span style="color:${lepStatus.color};font-weight:bold"> — ${lepStatus.label}!</span>`
      : "";
    resourceLine = `💔 ${targetActor.name}: ${oldLeP} → <strong style="color:#e94560">${newLeP}</strong> LeP${status}`;
  }

  // Wunden pruefen (nur wenn kein onlyLeP und echter Schaden)
  let woundLine = "";
  if (!damageInfo.onlyLeP && !damageInfo.onlyAuP && sp > 0 && hitZone) {
    const ko = targetActor.system?.KO?.value ?? 10;
    const ws = getWoundThresholds(ko);
    let newWounds = 0;
    if (sp >= ws.ws3)      newWounds = 3;
    else if (sp >= ws.ws2) newWounds = 2;
    else if (sp >= ws.ws1) newWounds = 1;

    if (newWounds > 0) {
      const wounds = targetActor.getFlag("dsa-pixel-tokens", "wounds") ?? {};
      wounds[hitZone] = (wounds[hitZone] ?? 0) + newWounds;
      await relayTokenUpdate(targetToken, { [`flags.${MODULE_ID}.wounds`]: wounds });
      const total = Object.values(wounds).reduce((s, w) => s + (w || 0), 0);
      woundLine = `<div style="color:#ff4444;margin-top:3px">💀 +${newWounds} Wunde${newWounds>1?"n":""} (${hitZoneLabel}) · Gesamt: ${total} · alle Proben −${total}</div>`;
    }
  }

  // Chat-Nachricht
  const immunityLine = immunity.immune ? `<div style="color:#888">🛡 Immun gegen ${damageInfo.element}!</div>`
    : immunity.resistant ? `<div style="color:#888">🛡 Resistent gegen ${damageInfo.element} — halber Schaden</div>`
    : immunity.vulnerable ? `<div style="color:#e94560">⚠ Verwundbar gegen ${damageInfo.element} — 1.5x Schaden</div>`
    : "";

  const rsLine = targetRS > 0
    ? `<div style="color:#888;font-size:12px">${tp} TP − ${targetRS} RS ${hitZoneLabel ? `(${hitZoneLabel})` : ""} = ${sp} SP</div>`
    : damageInfo.ignoresRS ? `<div style="color:#888;font-size:12px">${tp} TP (RS ignoriert) = ${sp} SP</div>`
    : `<div style="color:#888;font-size:12px">${tp} TP ${hitZoneLabel ? `(${hitZoneLabel})` : ""} = ${sp} SP</div>`;

  const aspNote = extraAsP > 0 ? `<div style="color:#4a90d9;font-size:12px">−${extraAsP} AsP (zusaetzlich)</div>` : "";

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">⚡ ${spellData.name} — Schaden</div>
      ${dmg.rollHTML || ""}
      <div style="text-align:center;font-size:13px;color:#c09040">${dmg.formulaLabel}</div>
      ${dmg.variantNote || ""}
      ${aspNote}
      ${immunityLine}
      ${gardianumNote}
      <div style="font-size:20px;color:#e94560;font-weight:bold;text-align:center;margin-top:4px">
        = ${sp} ${damageInfo.onlyAuP ? "AuP" : "SP"}
      </div>
      ${rsLine}
      ${rsReductionNote}
      <div style="margin-top:4px;padding:3px 6px;background:rgba(233,69,96,0.15);border:1px solid rgba(233,69,96,0.3);border-radius:3px;text-align:center;font-size:13px">
        ${resourceLine}
      </div>
      ${woundLine}
    </div>`,
  });

  // VFX (broadcastet an ALLE Clients): Schadenflash + Scrolling-Schadenszahl
  if (sp > 0 && targetToken) {
    broadcastVFX({ kind: "effect", x: targetToken.center.x, y: targetToken.center.y, effect: "schadenflash" });
    const ko2 = targetActor.system?.KO?.value ?? 10;
    const ws2 = getWoundThresholds(ko2);
    const woundLevel = sp >= ws2.ws3 ? 3 : sp >= ws2.ws2 ? 2 : sp >= ws2.ws1 ? 1 : 0;
    const dmgColor = woundLevel >= 3 ? "#ff0000" : woundLevel >= 1 ? "#ff4444" : "#ffaa44";
    const dmgFont = woundLevel >= 1 ? 42 : 32;
    broadcastVFX({
      kind: "scrollingText",
      tgtTokenId: targetToken.id,
      text: `-${sp}`,
      color: dmgColor,
      fontSize: dmgFont,
      duration: 1800,
      distance: 90,
    });
  } else if (targetToken) {
    // 0-SP: kleines "0" zeigen damit der Spieler weiß "Treffer aber abgewehrt"
    broadcastVFX({
      kind: "scrollingText",
      tgtTokenId: targetToken.id,
      text: damageInfo.onlyAuP ? "0 AuP" : "0",
      color: "#888888",
      fontSize: 22,
    });
  }
}

// ─── Flächenschaden für Ignisphaero / Igniplano / Wand-Sprüche ──────────────
//
// LCR S.140 Ignisphaero: 5W6 + ZfP*/2 TP im Zentrum; pro Schritt Entfernung
// sinkt der Schaden um (1 + niedrigster Würfel der Schadensrolle).
// damageInfo:
//   aoeRadius: maximaler Wirkungsradius in Schritt
//   aoeFalloff: "perStepMinusOnePlusMinDie" (Ignisphaero) | "linear" (Igniplano)
async function _applyAoESpellDamage(caster, spellData, damageInfo, alreadyPaidAsP, zfpStar, centerToken) {
  const zfw = Number(actorFindSkill(caster, spellData.name)?.value ?? spellData.zfw ?? 0);
  const aspData = resolveActorAsP(caster);
  const currentAsP = aspData?.val ?? 0;
  const aspMax = currentAsP + (alreadyPaidAsP || 0);

  // Schaden EINMAL würfeln — gilt als Zentrum-Schaden für alle Tokens im Radius
  const dmg = await rollSpellDamage(spellData.name, damageInfo, {
    zfw, zfpStar: zfpStar || 0, aspMax, aspBaseCost: alreadyPaidAsP || 0,
  });
  if (!dmg) return;

  const extraAsP = Math.max(0, dmg.aspCost - (alreadyPaidAsP || 0));
  if (extraAsP > 0 && aspData?.path) {
    await caster.update({ [aspData.path]: Math.max(0, currentAsP - extraAsP) });
  }

  const baseTP = dmg.tp;
  // Niedrigster Würfel der Schadensrolle — wird für Falloff gebraucht
  const minDie = (dmg.diceResults && dmg.diceResults.length > 0)
    ? Math.min(...dmg.diceResults)
    : 1;
  const stepsPerStep = damageInfo.aoeFalloff === "perStepMinusOnePlusMinDie"
    ? (1 + minDie)
    : Math.max(1, Math.floor(baseTP / damageInfo.aoeRadius)); // linear

  // Center-Position
  const cx = centerToken.center?.x ?? centerToken.x;
  const cy = centerToken.center?.y ?? centerToken.y;
  const gridSize = canvas.grid.size;
  const radiusPx = damageInfo.aoeRadius * gridSize;

  // ── Projektil-Flug Caster → Ziel-Zentrum (alle Clients sehen es) ───────
  const casterToken = caster.getActiveTokens?.()[0];
  if (casterToken && centerToken && casterToken.id !== centerToken.id) {
    broadcastVFX({
      kind: "projectile",
      srcTokenId: casterToken.id,
      tgtTokenId: centerToken.id,
      projectile: "feuerball",
      impact: null, // Impact kommt unten über XXL-Effekt
    });
    // Flugzeit warten, bevor Explosion zündet
    const dx = (centerToken.center?.x ?? cx) - (casterToken.center?.x ?? cx);
    const dy = (centerToken.center?.y ?? cy) - (casterToken.center?.y ?? cy);
    const dist = Math.hypot(dx, dy);
    const travelMs = Math.max(250, Math.round((dist / gridSize) * 80));
    await new Promise(r => setTimeout(r, travelMs));
  }

  // ── XXL-Explosion am Zentrum (broadcastet an alle Clients) ─────────────
  broadcastVFX({ kind: "effect", x: cx, y: cy, effect: "feuerball_xxl" });

  // Alle Tokens im Radius sammeln (inkl. Caster wenn er drin steht — er kann sich selbst treffen)
  const affectedTokens = [];
  for (const t of canvas.tokens.placeables) {
    if (!t.actor) continue;
    const tx = t.center?.x ?? t.x;
    const ty = t.center?.y ?? t.y;
    const dx = tx - cx;
    const dy = ty - cy;
    const distPx = Math.hypot(dx, dy);
    if (distPx > radiusPx) continue;
    const distSchritt = distPx / gridSize;
    affectedTokens.push({ token: t, actor: t.actor, distSchritt });
  }

  // Pro Token Schaden berechnen + anwenden
  // LCR S.140: "Der angerichtete Schaden beträgt bis 1 Schritt Entfernung von
  // der Explosion 5W6+ZfP*/2 TP. Für jeden Schritt Entfernung sinkt der
  // Schaden um 1 + den Würfel mit der niedrigsten Augenzahl."
  // → bis 1 Schritt VOLLER Schaden, danach pro Schritt darüber − stepsPerStep
  const reportLines = [];
  for (const { token, actor, distSchritt } of affectedTokens) {
    const distBeyondOne = Math.max(0, distSchritt - 1);
    const tpAtDist = Math.max(0, Math.round(baseTP - distBeyondOne * stepsPerStep));
    if (tpAtDist <= 0) {
      reportLines.push(`<div style="color:#666;font-size:11px">· ${actor.name} (${distSchritt.toFixed(1)} S) — außer Reichweite</div>`);
      continue;
    }

    // Element-Immunität
    const immunity = _checkElementalImmunity(actor, dmg.element ?? damageInfo.element);
    let tp = tpAtDist;
    if (immunity.immune)        tp = 0;
    else if (immunity.resistant)  tp = Math.floor(tp / 2);
    else if (immunity.vulnerable) tp = Math.floor(tp * 1.5);

    // Gardianum-Absorption (pro Token einzeln)
    let absorbedTP = 0;
    if (tp > 0) {
      const absorb = await tryGardianumAbsorb(actor, token, damageInfo, tp, spellData.name);
      absorbedTP = absorb.absorbedTP || 0;
      tp = absorb.remainingTP;
    }

    // RS (Brust-Standard für AoE)
    let targetRS = damageInfo.ignoresRS ? 0 : _getTargetRS(actor, "brust");
    if (damageInfo.perTenTpRSReduction && targetRS > 0) {
      const reduction = Math.floor(tp / 10);
      if (reduction > 0) targetRS = Math.max(0, targetRS - reduction);
    }

    const sp = Math.max(0, tp - targetRS);
    if (sp <= 0) {
      reportLines.push(`<div style="color:#666;font-size:11px">· ${actor.name} (${distSchritt.toFixed(1)} S): ${tpAtDist} TP − ${targetRS} RS = 0 SP</div>`);
      // Auch bei "abgewehrt" einen kleinen Flash zeigen + 0-SP-Text
      broadcastVFX({ kind: "effect", x: token.center.x, y: token.center.y, effect: "schadenflash" });
      broadcastVFX({ kind: "scrollingText", tgtTokenId: token.id, text: `0`, color: "#888888", fontSize: 22 });
      continue;
    }

    // LeP abziehen via Token-aware Relay (handelt linked + unlinked korrekt)
    const oldLeP = actor.system?.LeP?.value ?? 0;
    const newLeP = Math.max(0, oldLeP - sp);
    await relayTokenUpdate(token, { "system.LeP.value": newLeP });

    // Wunden bei AoE: standardmäßig nicht (ignoreZones), außer sp >= ws-Schwelle
    const ko = actor.system?.KO?.value ?? 10;
    const ws = getWoundThresholds(ko);
    let newWounds = 0;
    if (sp >= ws.ws3)      newWounds = 3;
    else if (sp >= ws.ws2) newWounds = 2;
    else if (sp >= ws.ws1) newWounds = 1;
    let woundNote = "";
    if (newWounds > 0) {
      const wounds = actor.getFlag(MODULE_ID, "wounds") ?? {};
      wounds.brust = (wounds.brust ?? 0) + newWounds;
      await relayTokenUpdate(token, { [`flags.${MODULE_ID}.wounds`]: wounds });
      woundNote = ` <span style="color:#ff4444">${"💀".repeat(newWounds)}</span>`;
    }

    const distLabel = distSchritt < 0.5 ? "Zentrum" : `${distSchritt.toFixed(1)} S`;
    // WdS S.78: getLepStatus mit Eisern/Zäher Hund/Selbstbeherrschung
    const lepFlags = _getLepStatusFlags(actor);
    const lepStatus = getLepStatus(newLeP, ko, lepFlags);
    const koMark = lepStatus.label
      ? ` <strong style="color:${lepStatus.color}">— ${lepStatus.label}!</strong>`
      : "";
    reportLines.push(
      `<div style="color:#e94560;font-size:12px;padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        💔 <strong>${actor.name}</strong> (${distLabel}): ${tpAtDist} TP${immunity.immune ? " (immun → 0)" : immunity.resistant ? " ÷2" : immunity.vulnerable ? " ×1.5" : ""}
        ${absorbedTP > 0 ? ` − ${absorbedTP} Gardianum` : ""}
        ${targetRS > 0 ? ` − ${targetRS} RS` : ""}
        = <strong>${sp} SP</strong> · LeP ${oldLeP}→${newLeP}${koMark}${woundNote}
      </div>`
    );

    // ── VFX (broadcastet an ALLE Clients) ────────────────────────────
    // Schadenflash auf dem Token
    broadcastVFX({ kind: "effect", x: token.center.x, y: token.center.y, effect: "schadenflash" });
    // Scrolling-Schadenszahl über dem Token (rot, größer wenn Wunde)
    const dmgColor = newWounds >= 3 ? "#ff0000"
                  : newWounds >= 1 ? "#ff4444"
                  : "#ffaa44";
    const dmgFont = newWounds >= 1 ? 42 : 32;
    broadcastVFX({
      kind: "scrollingText",
      tgtTokenId: token.id,
      text: `-${sp}`,
      color: dmgColor,
      fontSize: dmgFont,
      duration: 1800,
      distance: 90,
    });
    // Bei Wunden zusätzlich kurz "💀 Wunde!" einblenden
    if (newWounds > 0) {
      setTimeout(() => {
        broadcastVFX({
          kind: "scrollingText",
          tgtTokenId: token.id,
          text: `💀 +${newWounds} Wunde${newWounds > 1 ? "n" : ""}`,
          color: "#ff4444",
          fontSize: 22,
          duration: 1500,
          distance: 60,
        });
      }, 600);
    }
  }

  // Kein Token getroffen?
  const damageReport = reportLines.length > 0
    ? reportLines.join("")
    : `<div style="color:#666">Keine Tokens im Wirkungsradius.</div>`;

  // Caster-Zusatzkosten (Ignisphaero: +1W6 LeP +1 AuP)
  // Note: Diese sind im aspCost-String, muss manuell gehandhabt werden
  // → wird im Chat als Hinweis angezeigt

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="dsa-pixel-chat">
      <div class="chat-title">⚡ ${spellData.name} — Flächenschaden</div>
      ${dmg.rollHTML || ""}
      <div style="text-align:center;font-size:13px;color:#c09040">${dmg.formulaLabel} · Min-W6: ${minDie} · Falloff: −${stepsPerStep}/Schritt · Radius ${damageInfo.aoeRadius} S</div>
      ${dmg.variantNote || ""}
      ${extraAsP > 0 ? `<div style="color:#4a90d9;font-size:12px;text-align:center">−${extraAsP} AsP zusätzlich</div>` : ""}
      <div style="margin-top:6px;padding:4px 6px;background:rgba(233,69,96,0.10);border-left:3px solid #e94560;border-radius:3px">
        <div style="font-size:11px;color:#aaa;margin-bottom:2px">Zentrum: ${centerToken.actor?.name ?? "Position"}</div>
        ${damageReport}
      </div>
      ${spellData.kosten?.includes("LeP") ? `<div style="margin-top:4px;padding:3px 6px;background:rgba(180,40,40,0.15);border:1px solid rgba(180,40,40,0.3);border-radius:3px;font-size:11px;color:#fbb;text-align:center">⚠ Zauberer-Kosten: ${spellData.kosten} — manuell abziehen!</div>` : ""}
    </div>`,
  });

  // (Der zentrale XXL-Effekt wurde bereits oben vor der Schaden-Schleife
  // gebroadcastet — hier kein doppelter Effekt nötig.)
}

// ─── Elementare Immunitaet pruefen ──────────────────────────────────────────

function _checkElementalImmunity(targetActor, element) {
  if (!targetActor || !element) return { immune: false, resistant: false, vulnerable: false };

  const creatureFlag = targetActor.getFlag("dsa-pixel-tokens", "creature");
  const abilities = [
    ...(creatureFlag?.abilities ?? []),
    ...(Array.isArray(targetActor.system?.sf) ? targetActor.system.sf : Object.keys(targetActor.system?.sf ?? {})),
  ].map(a => (typeof a === "string" ? a : (a?.name ?? "")).toLowerCase());

  const elementLow = element.toLowerCase();
  const joined = abilities.join(" | ");

  // Immun
  if (joined.match(new RegExp(`immun[^|]*${elementLow}|immunit[aä]t[^|]*${elementLow}`))) {
    return { immune: true, resistant: false, vulnerable: false };
  }
  // Verwundbar / Empfindlich
  if (joined.match(new RegExp(`verwundbar[^|]*${elementLow}|empfindlich[^|]*${elementLow}`))) {
    return { immune: false, resistant: false, vulnerable: true };
  }
  // Resistent
  if (joined.match(new RegExp(`resisten[tz][^|]*${elementLow}|widerstand[^|]*${elementLow}`))) {
    return { immune: false, resistant: true, vulnerable: false };
  }
  return { immune: false, resistant: false, vulnerable: false };
}

// ─── Zonen-RS des Ziels ermitteln ───────────────────────────────────────────

function _getTargetRS(actor, zone) {
  if (!actor) return 0;
  // Kreatur: natuerlicher RS (alle Zonen gleich)
  const creatureFlag = actor.getFlag("dsa-pixel-tokens", "creature");
  if (creatureFlag?.rs !== undefined) return creatureFlag.rs;
  // Spieler: Zonen-RS aus Ruestungs-Items
  const armorDb = globalThis.DSAPixelData?.armorZones?.armor ?? [];
  let zoneRS = 0;
  for (const item of actor.items) {
    const sys = item.system ?? {};
    const t = item.type?.toLowerCase();
    if (t === "gegenstand" && sys.type === "armor") {
      const dbEntry = armorDb.find(a => a.name.toLowerCase() === item.name.toLowerCase());
      if (zone && dbEntry?.zones?.[zone] !== undefined) {
        zoneRS += dbEntry.zones[zone];
      } else {
        zoneRS += (sys.armor?.rs ?? 0);
      }
    }
  }
  return zoneRS;
}

// Helper: Zauberfertigkeit auf Actor finden
function actorFindSkill(actor, spellName) {
  const skills = actor.system?.skill ?? {};
  return skills[spellName] ?? null;
}

// ─── Zauber-VFX triggern ────────────────────────────────────────────────────

function _triggerSpellEffect(actor, mapping, spellData) {
  const casterToken = actor.getActiveTokens()[0];
  const targetToken = [...(game.user?.targets ?? [])][0];

  if (!casterToken) return;

  switch (mapping.type) {
    case "projectile":
      if (targetToken && targetToken !== casterToken) {
        DSAPixelTokens.spawnProjectile(casterToken, targetToken, mapping.effect, mapping.impact ?? mapping.effect);
      } else if (targetToken) {
        DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, mapping.effect);
      }
      break;

    case "target":
      if (targetToken) {
        DSAPixelTokens.spawnEffect(targetToken.center.x, targetToken.center.y, mapping.effect);
      }
      break;

    case "aura":
      DSAPixelTokens.spawnEffect(casterToken.center.x, casterToken.center.y, mapping.effect);
      break;

    case "zone":
      // Zone: Notification — User muss Template platzieren, dann Zone-Picker
      ui.notifications.info(`${spellData.name} gelungen! Platziere ein Mess-Template und wähle den Zonen-Effekt.`);
      break;
  }
}

// ─── Zone-Markierung nach Zauber ────────────────────────────────────────────

/**
 * Hook für Chat-Buttons: Wenn "Zone markieren" geklickt wird,
 * aktiviert den Template-Platzierungs-Modus.
 */
export function registerMagicChatHooks() {
  Hooks.on("renderChatMessage", (message, html) => {
    html.find('[data-action="mark-zone"]').on("click", async (e) => {
      const spellName = e.currentTarget.dataset.spell;
      ui.notifications.info(`Platziere ein Template (Kreis/Kegel) auf der Karte, dann klicke darauf für den Zonen-Effekt.`);

      // Automatisch den passenden Zone-Effekt vorschlagen wenn Template erstellt wird
      Hooks.once("createMeasuredTemplate", async (templateDoc) => {
        if (typeof DSAPixelTokens === "undefined") return;

        // Finde passenden Zone-Preset
        const mapping = lookupSpellEffect(spellName);
        if (!mapping) return;

        // Zone-Presets durchsuchen nach passendem Effekt
        const zonePresets = DSAPixelTokens.ZONE_PRESETS ?? {};
        const matchingZone = Object.entries(zonePresets).find(([name, preset]) => {
          // Feuer-Zauber → zone_feuer, Eis → zone_eis, etc.
          const spellLower = spellName.toLowerCase();
          if (spellLower.includes("feuer") || spellLower.includes("igni") || spellLower.includes("flamm")) return name === "zone_feuer";
          if (spellLower.includes("eis") || spellLower.includes("frost")) return name === "zone_eis";
          if (spellLower.includes("gift") || spellLower.includes("odem")) return name === "zone_gift";
          if (spellLower.includes("heil") || spellLower.includes("balsa")) return name === "zone_heilung";
          if (spellLower.includes("sturm") || spellLower.includes("wind") || spellLower.includes("blitz")) return name === "zone_sturm";
          if (spellLower.includes("dunkel") || spellLower.includes("schatten")) return name === "zone_dunkel";
          return false;
        });

        if (matchingZone) {
          const [zoneName] = matchingZone;
          await DSAPixelTokens.spawnZoneEffect(templateDoc, zoneName);
        } else {
          // Kein Match → Zone-Picker öffnen
          DSAPixelTokens.showZonePicker(templateDoc);
        }
      });
    });
  });
}

// ─── Hook Registration ──────────────────────────────────────────────────────

export function registerMagicHooks() {
  registerMagicChatHooks();
  console.log(`[${MODULE_ID}] ✓ Magic System registriert`);
}
