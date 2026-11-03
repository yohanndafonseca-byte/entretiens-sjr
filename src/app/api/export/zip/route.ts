import { NextResponse } from "next/server";
import JSZip from "jszip";
import { utilisateurCourant } from "@/lib/auth";
import { chargerDossier, lignesListe } from "@/lib/dossier";
import { cheminServeur, nomFichierPdf } from "@/lib/pdf";
import { classeurExcel } from "@/lib/tableur";
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
  const aplat = p.get("rangement") === "plat";
  const zip = new JSZip();
  const sommaire: Record<string, unknown>[] = [];
  for (const l of lignes.sort((a, b) => a.agentNom.localeCompare(b.agentNom))) {
    const d = await chargerDossier(l.id);
    if (!d) continue;
    const chemin = aplat ? nomFichierPdf(d) : cheminServeur(d);
    zip.file(chemin, await pdfDuDossier(d));
    sommaire.push({
      nom: d.agent.nom,
      prenom: d.agent.prenom,
      matricule: d.agent.matricule,
      collectivite: l.collectivite,
      statut: l.statutAgent,
      direction: l.niv3,
      pole: l.niv4,
      dateEntretien: d.entretien.dateEntretien?.split("-").reverse().join("/") ?? "",
      termine: d.entretien.termineLe ? d.entretien.termineLe.toLocaleDateString("fr-FR") : "non terminé (provisoire)",
      fichier: chemin,
    });
  }
  zip.file(
    "Sommaire.xlsx",
    await classeurExcel([
      {
        nom: "Sommaire",
        colonnes: [
          { titre: "Nom", cle: "nom", largeur: 18 },
          { titre: "Prénom", cle: "prenom", largeur: 14 },
          { titre: "Matricule", cle: "matricule", largeur: 11 },
          { titre: "Collectivité", cle: "collectivite", largeur: 10 },
          { titre: "Statut", cle: "statut", largeur: 13 },
          { titre: "Direction", cle: "direction", largeur: 30 },
          { titre: "Pôle", cle: "pole", largeur: 25 },
          { titre: "Date de l'entretien", cle: "dateEntretien", largeur: 14 },
          { titre: "Visa final le", cle: "termine", largeur: 14 },
          { titre: "Fichier dans l'archive", cle: "fichier", largeur: 60 },
        ],
        lignes: sommaire,
      },
    ]),
  );
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const nom = `Entretiens pro ${lignes[0].annee}${direction ? ` - ${direction}` : ""}${collectivite ? ` - ${collectivite}` : ""}.zip`;
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}` },
  });
}
