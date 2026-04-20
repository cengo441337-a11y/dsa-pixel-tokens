/**
 * DSA Pixel-Art Tokens — Datenbank-Browser Dialog
 *
 * Arbeitet mit templates/dialogs/db-browser.hbs zusammen.
 * Das Template rendert alle Daten als versteckte DOM-Elemente; dieses
 * Script übernimmt: Tab-Wechsel, Live-Suche, Kategorie-Filter,
 * Zeilen-Selektion, Detail-Anzeige und das Hinzufügen zum Actor.
 */

import { MODULE_ID } from "./config.mjs";

// ─── Interne Hilfsfunktionen ─────────────────────────────────────────────────

/**
 * Rüstungsdaten aus globalThis.DSAPixelData (armor-zones.json oder armor.json).
 */
function _getArmorData() {
  const d = globalThis.DSAPixelData;
  if (!d) return [];
  if (d.armorZones?.armor?.length) return d.armorZones.armor;
  if (Array.isArray(d.armor)) return d.armor;
  return [];
}

/** Kürzt einen String auf maxLen Zeichen mit "…". */
function _truncate(str, maxLen) {
  if (typeof str !== "string") return "";
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
}

// ─── Item-Erstellungs-Schemata ───────────────────────────────────────────────

function _buildMeleeWeaponItem(w) {
  const desc = [
    w.tp          ? `TP: ${w.tp}`                                         : null,
    w.talent      ? `Talent: ${w.talent}`                                 : null,
    w.bf != null  ? `BF: ${w.bf}`                                         : null,
    w.kkSchwelle  ? `KK: ${w.kkSchwelle}`                                 : null,
    w.atMod != null ? `AT: ${w.atMod >= 0 ? "+" : ""}${w.atMod}`         : null,
    w.paMod != null ? `PA: ${w.paMod >= 0 ? "+" : ""}${w.paMod}`         : null,
    w.laenge      ? `Länge: ${w.laenge} cm`                               : null,
  ].filter(Boolean).join(" | ");

  return {
    name: w.name,
    type: "Gegenstand",
    system: {
      type: "melee",
      weight: w.gewicht ?? 0,
      value: 0,
      quantity: 1,
      worn: true,
      description: desc,
      weapon: {
        damage: w.tp ?? "",
        DK: w.reichweite ?? "N",
        type: w.talent ?? "",
      },
      trait: w.tp ?? "",
      size: 0,
      pAsP: 0,
    },
  };
}

function _buildRangedWeaponItem(w) {
  const ranges = typeof w.reichweiten === "string" ? w.reichweiten.split("/") : [];
  const desc = [
    w.tp          ? `TP: ${w.tp}`                                   : null,
    w.talent      ? `Talent: ${w.talent}`                           : null,
    w.reichweiten ? `Reichweiten: ${w.reichweiten}`                 : null,
    w.gewicht     ? `Gewicht: ${w.gewicht} U`                       : null,
  ].filter(Boolean).join(" | ");

  return {
    name: w.name,
    type: "Gegenstand",
    system: {
      type: "range",
      weight: w.gewicht ?? 0,
      value: 0,
      quantity: 1,
      worn: true,
      description: desc,
      weapon: {
        damage: w.tp ?? "",
        type: w.talent ?? "",
        range1: ranges[1] ?? "",
        range2: ranges[2] ?? "",
        range3: ranges[3] ?? "",
      },
      trait: w.tp ?? "",
      size: 0,
      pAsP: 0,
    },
  };
}

function _buildArmorItem(a) {
  const rs = a.rs ?? a.gRS ?? 0;
  const be = a.be ?? a.gBE ?? 0;
  const gRaw = a.gewicht ?? 0;
  const gFmt = gRaw > 100
    ? `${(gRaw / 1000).toFixed(1)} kg`
    : `${gRaw} U`;

  const desc = [
    `RS: ${rs}`,
    `BE: ${be}`,
    a.preis   ? `Preis: ${a.preis}`  : null,
    gRaw > 0  ? `Gewicht: ${gFmt}`  : null,
  ].filter(Boolean).join(" | ");

  return {
    name: a.name,
    type: "Gegenstand",
    system: {
      type: "armor",
      weight: gRaw,
      value: 0,
      quantity: 1,
      worn: true,
      description: desc,
      armor: { rs, be },
      trait: `RS ${rs} / BE ${be}`,
      size: 0,
      pAsP: 0,
    },
  };
}

function _buildShieldItem(s) {
  const fmt = v => (v != null ? `${v >= 0 ? "+" : ""}${v}` : "0");
  const desc = [
    `AT: ${fmt(s.atMod)}`,
    `PA: ${fmt(s.paMod)}`,
    `INI: ${fmt(s.ini)}`,
    s.bf != null ? `BF: ${s.bf}` : null,
    s.gewicht    ? `Gewicht: ${(s.gewicht / 1000).toFixed(2)} kg` : null,
  ].filter(Boolean).join(" | ");

  return {
    name: s.name,
    type: "Gegenstand",
    system: {
      type:     "shield",
      weight:   s.gewicht ?? 0,
      value:    0,
      quantity: 1,
      worn:     true,
      description: desc,
      shield: {
        atMod: s.atMod ?? 0,
        paMod: s.paMod ?? 0,
        ini:   s.ini   ?? 0,
        bf:    s.bf    ?? 0,
      },
      trait: `Schild AT${fmt(s.atMod)} PA${fmt(s.paMod)}`,
      size:  0,
      pAsP:  0,
    },
  };
}

function _buildSpellItem(s, zfw = 0) {
  const probe = Array.isArray(s.probe)
    ? s.probe
    : [s.att1 ?? "KL", s.att2 ?? "IN", s.att3 ?? "FF"];

  return {
    name: s.name,
    type: "spell",
    system: {
      att1: probe[0] ?? "KL",
      att2: probe[1] ?? "IN",
      att3: probe[2] ?? "FF",
      zfw: Number(zfw) || 0,
      costs: s.kosten ?? "4 AsP",
      description: [
        s.wirkung ?? "",
        s.merkmal       ? `Merkmal: ${s.merkmal}`                              : "",
        s.komplexitaet  ? `Komplexität: ${s.komplexitaet}`                     : "",
        Array.isArray(s.verbreitung) && s.verbreitung.length
          ? `Verbreitung: ${s.verbreitung.join(", ")}`
          : "",
      ].filter(Boolean).join("\n\n"),
    },
  };
}

function _buildAlchemikaItem(a) {
  const desc = [
    a.wirkung   ? `Wirkung: ${a.wirkung}`   : null,
    a.typ       ? `Typ: ${a.typ}`           : null,
    a.preis     ? `Preis: ${a.preis}`       : null,
  ].filter(Boolean).join("\n");

  return {
    name: a.name,
    type: "Gegenstand",
    system: {
      type: "loot",
      weight: a.gewicht ?? 0.1,
      value: 0,
      quantity: 1,
      worn: false,
      description: desc || a.beschreibung || "",
      trait: "Alchemika",
      size: 0,
      pAsP: 0,
    },
  };
}

// ─── DSADatabaseBrowser ──────────────────────────────────────────────────────

export class DSADatabaseBrowser extends Application {

  /**
   * @param {Actor}  actor       - Foundry Actor, dem Items hinzugefügt werden
   * @param {string} initialTab  - "waffen" | "ruestungen" | "zauber" | "alchemika"
   */
  constructor(actor, initialTab = "waffen") {
    super();
    if (!actor) throw new Error(`[${MODULE_ID}] DSADatabaseBrowser: actor is required`);
    this.actor       = actor;
    this._activeTab  = initialTab;
    this._search     = "";
    this._catFilter  = "";
    this._selIndex   = -1;   // index into current tab's data array
    this._selZfw     = 0;    // ZfW for spells
  }

  // ─── Application Options ───────────────────────────────────────────────────

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        "dsa-db-browser",
      title:     "Datenbank-Browser",
      template:  `modules/${MODULE_ID}/templates/dialogs/db-browser.hbs`,
      width:     700,
      height:    580,
      resizable: true,
      classes:   ["dsa-pixel-db-browser"],
    });
  }

  // ─── Template Data ─────────────────────────────────────────────────────────

  getData() {
    const d = globalThis.DSAPixelData ?? {};

    // Waffen: nahkampf + fernkampf + schilde zusammenführen, _kategorie anhängen
    const nahkampf = Array.isArray(d.weapons?.nahkampfwaffen) ? d.weapons.nahkampfwaffen : [];
    const fernkampf = Array.isArray(d.weapons?.fernkampfwaffen) ? d.weapons.fernkampfwaffen : [];
    const schilde  = Array.isArray(d.weapons?.schilde)         ? d.weapons.schilde         : [];

    const weapons = [
      ...nahkampf.map(w => ({ ...w, _kategorie: "nahkampf", typ: w.typ ?? "nahkampf" })),
      ...fernkampf.map(w => ({ ...w, _kategorie: "fernkampf", typ: w.typ ?? "fernkampf" })),
      ...schilde.map(w  => ({ ...w, _kategorie: "schild",    typ: w.typ ?? "schild" })),
    ];

    // Probe-Display für Template (string, damit {{this.probeDisplay}} klappt)
    const spells = (Array.isArray(d.spells) ? d.spells : []).map(s => ({
      ...s,
      probeDisplay: Array.isArray(s.probe) ? s.probe.join("/") : null,
    }));

    const armor    = _getArmorData();
    const alchemika = Array.isArray(d.alchemika) ? d.alchemika : [];

    return {
      actor:      this.actor,
      tab:        this._activeTab,
      weapons,
      armor,
      spells,
      alchemika,
    };
  }

  // ─── Listeners ─────────────────────────────────────────────────────────────

  activateListeners(html) {
    super.activateListeners(html);

    // ── Initialer Tab anzeigen ──────────────────────────────────────────────
    this._applyTabVisibility(html);
    this._injectZfwInput(html);

    // ── Tab Switching ───────────────────────────────────────────────────────
    html.find(".db-tab-btn").on("click", (ev) => {
      const tab = ev.currentTarget.dataset.tab;
      if (tab === this._activeTab) return;
      this._activeTab = tab;
      this._search    = "";
      this._catFilter = "";
      this._selIndex  = -1;
      this._selZfw    = 0;

      // Tab-Buttons markieren
      html.find(".db-tab-btn").removeClass("active");
      $(ev.currentTarget).addClass("active");

      // Category-Filter auf Tab-Standard zurücksetzen
      html.find("#db-category-filter").val("");

      // Search leeren
      html.find("#db-search-input").val("");

      this._applyTabVisibility(html);
      this._applyFilters(html);
      this._hideAllDetails(html);
      this._showEmptyDetail(html);
      this._injectZfwInput(html);
    });

    // ── Live-Suche ──────────────────────────────────────────────────────────
    html.find("#db-search-input").on("input", (ev) => {
      this._search = ev.currentTarget.value.toLowerCase().trim();
      this._applyFilters(html);
    });

    // ── Kategorie-Filter ────────────────────────────────────────────────────
    html.find("#db-category-filter").on("change", (ev) => {
      this._catFilter = ev.currentTarget.value.toLowerCase().trim();
      this._applyFilters(html);
    });

    // ── Zeilen-Klick (Selektion + Detail) ───────────────────────────────────
    html.find(".db-row").on("click", (ev) => {
      const row = ev.currentTarget;
      const tab = row.dataset.tab;
      if (tab !== this._activeTab) return;

      const idx = parseInt(row.dataset.itemIndex, 10);
      if (isNaN(idx)) return;

      // Highlight
      html.find(`.db-row[data-tab="${tab}"]`).removeClass("selected");
      $(row).addClass("selected");

      this._selIndex = idx;
      this._showDetail(html, tab, idx);
      this._updateAddButton(html, true);
    });

    // ── Doppel-Klick → sofort hinzufügen ────────────────────────────────────
    html.find(".db-row").on("dblclick", (ev) => {
      const row = ev.currentTarget;
      const tab = row.dataset.tab;
      if (tab !== this._activeTab) return;

      const idx = parseInt(row.dataset.itemIndex, 10);
      if (isNaN(idx)) return;

      this._selIndex = idx;
      this._doAdd(html);
    });

    // ── "Zum Charakter hinzufügen" Button ────────────────────────────────────
    html.find("#db-add-btn").on("click", () => {
      this._doAdd(html);
    });

    // ── "Schließen" Button ───────────────────────────────────────────────────
    html.find("[data-action='close']").on("click", () => {
      this.close();
    });

    // Initial: Add-Button deaktivieren
    this._updateAddButton(html, false);

    // Initial: Filter anwenden (alle sichtbar)
    this._applyFilters(html);
  }

  // ─── Tab-Sichtbarkeit ─────────────────────────────────────────────────────

  /**
   * Blendet die richtigen db-tab-content divs ein und die anderen aus.
   */
  _applyTabVisibility(html) {
    html.find(".db-tab-content").hide();
    html.find(`.db-tab-content[data-tab-id="${this._activeTab}"]`).show();
  }

  // ─── Filter ───────────────────────────────────────────────────────────────

  /**
   * Wendet Suchtext und Kategoriefilter auf die Tabellenzeilen des aktiven Tabs an.
   */
  _applyFilters(html) {
    const tab     = this._activeTab;
    const search  = this._search;
    const catFilt = this._catFilter;

    html.find(`.db-row[data-tab="${tab}"]`).each((_, row) => {
      const $row = $(row);
      const name = ($row.data("name") ?? "").toLowerCase();
      const typ  = ($row.data("typ")  ?? "").toLowerCase();
      const merk = ($row.data("merkmal") ?? "").toLowerCase();
      const kat  = ($row.data("kategorie") ?? "").toLowerCase();

      let visible = true;

      // Textsuche: Name
      if (search && !name.includes(search)) visible = false;

      // Kategorie-Filter
      if (visible && catFilt) {
        if (tab === "waffen")   visible = typ.includes(catFilt);
        if (tab === "zauber")   visible = merk.toLowerCase().includes(catFilt);
        if (tab === "alchemika") visible = kat.includes(catFilt);
        // Rüstungen: kein Filter hier nötig, Zonen-Filter wäre komplex
      }

      $row.toggle(visible);
    });

    // Wenn die selektierte Zeile versteckt wurde, Auswahl aufheben
    if (this._selIndex >= 0) {
      const selRow = html.find(`.db-row[data-tab="${tab}"][data-item-index="${this._selIndex}"]`);
      if (selRow.is(":hidden")) {
        this._selIndex = -1;
        this._hideAllDetails(html);
        this._showEmptyDetail(html);
        this._updateAddButton(html, false);
      }
    }
  }

  // ─── Detail-Panel ─────────────────────────────────────────────────────────

  _hideAllDetails(html) {
    html.find(".db-detail-content").hide();
  }

  _showEmptyDetail(html) {
    html.find("#db-detail-empty").show();
  }

  _showDetail(html, tab, idx) {
    this._hideAllDetails(html);
    html.find("#db-detail-empty").hide();

    const panel = html.find(
      `.db-detail-content[data-detail-tab="${tab}"][data-detail-index="${idx}"]`
    );

    if (panel.length) {
      panel.show();
      // Spell-spezifisch: ZfW-Input einblenden und Wert setzen
      if (tab === "zauber") {
        this._injectZfwInput(html);
        html.find("#db-zfw-input").val(this._selZfw);
      }
    } else {
      // Fallback: leerer Zustand (sollte nicht passieren)
      this._showEmptyDetail(html);
    }
  }

  // ─── ZfW Input (nur für Zauber) ───────────────────────────────────────────

  /**
   * Fügt ein ZfW-Eingabefeld im Detail-Panel für Zauber ein, wenn es noch nicht
   * existiert. Wird nach Tab-Wechsel und nach showDetail aufgerufen.
   */
  _injectZfwInput(html) {
    // Alten Input entfernen (Tab-Wechsel)
    html.find(".db-zfw-row").remove();

    if (this._activeTab !== "zauber") return;

    const zfwRow = $(`
      <div class="db-zfw-row" style="
        display:flex; align-items:center; gap:8px;
        padding:8px 14px; border-top:1px solid rgba(160,120,40,0.28);
        background:rgba(0,0,0,0.25); flex-shrink:0;
      ">
        <label for="db-zfw-input" style="
          font-family:'Cinzel',serif; font-size:11px;
          color:rgba(90,86,104,1); text-transform:uppercase;
          letter-spacing:0.8px; white-space:nowrap;
        ">ZfW beim Hinzufügen:</label>
        <input id="db-zfw-input" type="number"
          value="${this._selZfw}" min="0" max="30" step="1"
          style="
            width:60px; text-align:center;
            background:#090912; border:1px solid rgba(200,151,42,0.55);
            color:#c8b4a0; font-family:'VT323',monospace; font-size:18px;
            border-radius:3px; padding:2px 4px;
          " />
      </div>
    `);

    // Vor dem Footer einfügen
    html.find(".db-footer").before(zfwRow);

    html.find("#db-zfw-input").on("change input", (ev) => {
      this._selZfw = parseInt(ev.currentTarget.value, 10) || 0;
    });
  }

  // ─── Add-Button Zustand ────────────────────────────────────────────────────

  _updateAddButton(html, enabled) {
    html.find("#db-add-btn").prop("disabled", !enabled);
  }

  // ─── Hinzufügen-Logik ─────────────────────────────────────────────────────

  /**
   * Liest den selektierten Eintrag, baut das Foundry-Item-Objekt und erstellt
   * es auf this.actor. Der Dialog bleibt offen.
   */
  async _doAdd(html) {
    if (this._selIndex < 0) {
      ui.notifications.warn("Kein Eintrag ausgewählt.");
      return;
    }

    const data = this.getData();
    let raw    = null;

    switch (this._activeTab) {
      case "waffen":     raw = data.weapons[this._selIndex];   break;
      case "ruestungen": raw = data.armor[this._selIndex];     break;
      case "zauber":     raw = data.spells[this._selIndex];    break;
      case "alchemika":  raw = data.alchemika[this._selIndex]; break;
    }

    if (!raw) {
      ui.notifications.warn("Eintrag nicht gefunden.");
      return;
    }

    const itemData = this._buildItemData(raw, this._activeTab);
    if (!itemData) return;

    await this._addItemToActor(itemData, this._activeTab);
  }

  // ─── Item Data Builder ────────────────────────────────────────────────────

  _buildItemData(raw, tab) {
    switch (tab) {
      case "waffen":
        if (raw._kategorie === "fernkampf") return _buildRangedWeaponItem(raw);
        if (raw._kategorie === "schild")    return _buildShieldItem(raw);
        return _buildMeleeWeaponItem(raw);
      case "ruestungen":
        return _buildArmorItem(raw);
      case "zauber":
        return _buildSpellItem(raw, this._selZfw);
      case "alchemika":
        return _buildAlchemikaItem(raw);
      default:
        return null;
    }
  }

  // ─── Actor Item Erstellung ────────────────────────────────────────────────

  async _addItemToActor(itemData, tab) {
    if (!itemData || !this.actor) return;

    try {
      const created = await this.actor.createEmbeddedDocuments("Item", [itemData]);
      if (created?.length) {
        ui.notifications.info(`${itemData.name} zu ${this.actor.name} hinzugefügt.`);
        console.log(
          `[${MODULE_ID}] DB-Browser: "${itemData.name}" (${tab}) → "${this.actor.name}"`
        );
      }
    } catch (err) {
      console.error(`[${MODULE_ID}] DB-Browser: Fehler beim Hinzufügen von "${itemData.name}":`, err);
      ui.notifications.error(
        `Fehler: ${itemData.name} konnte nicht hinzugefügt werden. Details in der Konsole.`
      );
    }
  }
}

// ─── Static Helper ────────────────────────────────────────────────────────────

/**
 * Öffnet den Datenbank-Browser für einen Actor.
 *
 * @param {Actor}  actor  - Foundry Actor
 * @param {string} [tab]  - Starttab: "waffen"|"ruestungen"|"zauber"|"alchemika"
 */
export function openDatabaseBrowser(actor, tab = "waffen") {
  if (!actor) {
    ui.notifications.warn(
      "Kein Charakter angegeben. Bitte zuerst einen Token oder Actor auswählen."
    );
    return;
  }
  try {
    new DSADatabaseBrowser(actor, tab).render(true);
  } catch (err) {
    console.error(`[${MODULE_ID}] openDatabaseBrowser:`, err);
    ui.notifications.error("Datenbank-Browser konnte nicht geöffnet werden.");
  }
}
