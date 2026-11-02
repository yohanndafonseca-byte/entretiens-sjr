import "server-only";
import ExcelJS from "exceljs";

export type Grille = (string | null)[][];

/** Normalise un en-tête de colonne : majuscules, sans accents, apostrophes droites, espaces simples. */
export function normEntete(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function valeurCellule(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear(), m = String(v.getUTCMonth() + 1).padStart(2, "0"), d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim() || null;
    if ("text" in v) return String(v.text).trim() || null;
    if ("result" in v) return v.result == null ? null : String(v.result).trim() || null;
    return null;
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parserCsv(texte: string): Grille {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  const candidats = [";", "\t", ","];
  const sep = candidats.sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0];
  const lignes: Grille = [];
  let ligne: (string | null)[] = [];
  let champ = "";
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (guillemets) {
      if (ch === '"') {
        if (texte[i + 1] === '"') { champ += '"'; i++; } else guillemets = false;
      } else champ += ch;
    } else if (ch === '"') guillemets = true;
    else if (ch === sep) { ligne.push(champ.trim() || null); champ = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ.trim() || null);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += ch;
  }
  if (champ || ligne.length) { ligne.push(champ.trim() || null); lignes.push(ligne); }
  return lignes.filter((l) => l.some((c) => c));
}

/** Lit un fichier Excel (.xlsx) ou CSV (UTF-8 ou Windows-1252) et renvoie la 1re feuille en grille. */
export async function lireTableur(fichier: File): Promise<Grille> {
  const buf = Buffer.from(await fichier.arrayBuffer());
  const nom = fichier.name.toLowerCase();
  if (nom.endsWith(".csv") || nom.endsWith(".txt")) {
    let texte = new TextDecoder("utf-8").decode(buf);
    if (texte.includes("�")) texte = new TextDecoder("windows-1252").decode(buf);
    return parserCsv(texte.replace(/^﻿/, ""));
  }
  if (nom.endsWith(".xls")) throw new Error("Format .xls (Excel 97) non pris en charge : enregistrez le fichier en .xlsx ou en .csv.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const grille: Grille = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: (string | null)[] = [];
    for (let c = 1; c <= ws.columnCount; c++) vals.push(valeurCellule(row.getCell(c).value));
    if (vals.some((v) => v)) grille.push(vals);
  });
  return grille;
}

/** Crée un classeur Excel à partir de lignes d'objets. */
export async function classeurExcel(feuilles: { nom: string; colonnes: { titre: string; cle: string; largeur?: number }[]; lignes: Record<string, unknown>[] }[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Entretiens professionnels – Ville de Saint-Jean-de-la-Ruelle";
  for (const f of feuilles) {
    const ws = wb.addWorksheet(f.nom.slice(0, 31));
    ws.columns = f.colonnes.map((c) => ({ header: c.titre, key: c.cle, width: c.largeur ?? 20 }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00AA40" } };
    ws.getRow(1).alignment = { vertical: "middle", wrapText: true };
    f.lignes.forEach((l) => ws.addRow(l));
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: f.colonnes.length } };
    ws.eachRow((r, i) => {
      if (i > 1) r.alignment = { vertical: "top", wrapText: true };
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
