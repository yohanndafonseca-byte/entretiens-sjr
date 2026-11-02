import { NextResponse } from "next/server";
import JSZip from "jszip";
import { utilisateurCourant } from "@/lib/auth";
import { chargerDossier, lignesListe } from "@/lib/dossier";
import { cheminServeur } from "@/lib/pdf";
import { pdfDuDossier } from "@/lib/workflow";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Archive zip des PDF, rangés comme sur le serveur : Ville|CCAS / Statut / NOM Prénom - EP année.pdf */
export async function GET(req: Request) {
  const u = await utilisateurCourant();
  if (!u?.isAdmin) return new NextResponse("Accès réservé aux RH", { status: 403 });
  const p = new URL(req.url).searchParams;
  const campagneId = Number(p.get("campagne"));
  const tous = p.get("tous") === "1";
  const direction = p.get("direction") || "";
  const collectivite = p.get("collectivite") || "";
  const lignes = (await lignesListe(undefined, campagneId))
    .filter((l) => tous || l.statut === "termine")
    .filter((l) => !direction || l.niv3 === direction)
    .filter((l) => !collectivite || l.collectivite === collectivite);
  if (!lignes.length) return new NextResponse("Aucun compte rendu ne correspond à ces critères.", { status: 404 });
  const zip = new JSZip();
  for (const l of lignes) {
    const d = await chargerDossier(l.id);
    if (!d) continue;
    zip.file(cheminServeur(d), await pdfDuDossier(d));
  }
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const nom = `Entretiens pro ${lignes[0].annee}${direction ? ` - ${direction}` : ""}${collectivite ? ` - ${collectivite}` : ""}.zip`;
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}` },
  });
}
