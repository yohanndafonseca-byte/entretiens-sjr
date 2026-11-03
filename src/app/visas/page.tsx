import Link from "next/link";
import { exigerUtilisateur } from "@/lib/auth";
import { chargerDossier, entretiensDe, nomComplet } from "@/lib/dossier";
import { TOUS_CRITERES } from "@/lib/formulaire";
import { Coquille } from "@/components/Entete";
import { FileVisas, type CarteVisa } from "@/components/FileVisas";
import { joursDepuis } from "@/components/Badges";

export const dynamic = "force-dynamic";

/** Visas hiérarchiques en attente, présentés sous forme de résumés pour les viser en série. */
export default async function PageVisas() {
  const u = await exigerUtilisateur();
  const { lignes } = await entretiensDe(u.id);
  const aViser = lignes.filter((l) => l.statut === "circuit" && l.acteurCourantId === u.id && l.agentId !== u.id);
  const cartes: CarteVisa[] = [];
  for (const l of aViser.sort((a, b) => a.agentNom.localeCompare(b.agentNom))) {
    const d = await chargerDossier(l.id);
    if (!d) continue;
    const notes = TOUS_CRITERES.map((k) => ({ k, n: d.contenu.criteres[k.id]?.note }));
    cartes.push({
      id: l.id,
      agent: nomComplet(d.agent),
      service: l.service,
      redacteur: nomComplet(d.redacteur),
      dateEntretien: d.entretien.dateEntretien?.split("-").reverse().join("/") ?? null,
      nonSatisfaites: notes.filter((x) => x.n === 2).map((x) => x.k.libelle),
      aAmeliorer: notes.filter((x) => x.n === 3).length,
      satisfaites: notes.filter((x) => x.n === 4).length,
      appreciation: d.contenu.appreciationGenerale,
      observations: d.etapes.filter((x) => x.viseLe && x.observations).map((x) => ({ qui: nomComplet(x.acteur), texte: x.observations! })),
      objectifs: d.contenu.objectifs.filter((o) => o.objectif.trim()).length,
      jours: joursDepuis(l.derniereActionLe),
    });
  }
  return (
    <Coquille u={u}>
      <Link href="/" className="text-sm text-gray-500 hover:underline">← Mes dossiers</Link>
      <h1 className="mb-1 mt-1 text-2xl font-bold">Mes visas en attente ({cartes.length})</h1>
      <p className="mb-4 max-w-3xl text-sm text-gray-600">
        Le résumé de chaque compte rendu, pour viser plusieurs dossiers en une fois. Pour ajouter une observation ou demander une correction, ouvrez le dossier.
      </p>
      <FileVisas cartes={cartes} />
    </Coquille>
  );
}
