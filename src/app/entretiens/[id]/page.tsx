import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/lib/auth";
import { calculerDroits, chargerDossier, nomComplet } from "@/lib/dossier";
import { Coquille } from "@/components/Entete";
import { FormulaireCR } from "@/components/FormulaireCR";
import { PanneauCircuit } from "@/components/PanneauCircuit";
import { BadgeStatut } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function PageEntretien({ params }: { params: Promise<{ id: string }> }) {
  const { id: idTxt } = await params;
  const id = Number(idTxt);
  const u = await exigerUtilisateur();
  const d = Number.isFinite(id) ? await chargerDossier(id) : null;
  if (!d) notFound();
  const droits = calculerDroits(u, d);
  if (!droits.voir) notFound();

  const snap = d.snapshot;
  const e = d.entretien;
  const derniere = d.etapes[d.etapes.length - 1];
  const libelle =
    e.statut === "redaction" ? "En rédaction" : e.statut === "termine" ? "Terminé" : `En attente du visa de ${nomComplet(d.etapeCourante?.acteur)}`;

  // L'agent ne voit son compte rendu qu'une fois visé par son N+1
  const masquerPourAgent = droits.estAgent && e.statut === "redaction" && !u.isAdmin;

  return (
    <Coquille u={u}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-gray-500 hover:underline">← Mes dossiers</Link>
        <h1 className="text-xl font-bold">{nomComplet(d.agent)} – entretien {d.campagne.annee}</h1>
        <BadgeStatut statut={e.statut} libelle={libelle} />
        <div className="flex-1" />
        {!masquerPourAgent && (
          <a href={`/entretiens/${id}/pdf`} className="btn-secondaire" target="_blank" rel="noreferrer">
            Télécharger le PDF{e.statut !== "termine" ? " (provisoire)" : ""}
          </a>
        )}
      </div>

      {masquerPourAgent ? (
        <div className="carte p-8 text-center text-gray-600">
          Votre responsable rédige actuellement le compte rendu de votre entretien. Vous recevrez une notification dès qu'il sera prêt à être visé.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <FormulaireCR
              id={id}
              editable={droits.editer}
              contenuInitial={d.contenu}
              dateInitiale={e.dateEntretien}
              entete={{
                agent: nomComplet(d.agent),
                services: [snap.niv3, snap.niv4, snap.niv5, snap.niv6].filter((x, i, t): x is string => !!x && t.indexOf(x) === i),
                grade: snap.grade ?? "",
                poste: snap.poste ?? "",
                statut: snap.statut ?? "",
                tempsTravail: snap.tempsTravail ?? "",
                redacteur: nomComplet(d.redacteur),
                annee: d.campagne.annee,
              }}
              objectifsVille={d.objectifsVille}
              objectifsDirection={d.objectifsDirection.map((o) => ({ libelle: o.libelle, texte: o.texte }))}
            />
          </div>
          <PanneauCircuit
            id={id}
            statut={e.statut}
            droits={droits}
            redacteur={nomComplet(d.redacteur)}
            visaRedacteurLe={e.visaRedacteurLe ? e.visaRedacteurLe.toISOString() : null}
            agentNom={nomComplet(d.agent)}
            derniereEtapeAgent={!!d.etapeCourante && d.etapeCourante.ordre === derniere?.ordre}
            etapes={d.etapes.map((x) => ({
              ordre: x.ordre,
              nom: nomComplet(x.acteur),
              estAgent: x.estAgent,
              viseLe: x.viseLe ? x.viseLe.toISOString() : null,
              observations: x.observations,
              modeVisa: x.modeVisa,
              courante: e.statut === "circuit" && x.ordre === e.etapeCourante,
            }))}
            historique={d.historique.map((h) => ({
              at: h.h.at.toISOString(),
              qui: h.nom ? `${h.nom} ${h.prenom}` : "",
              action: h.h.action,
              details: h.h.details,
            }))}
            recours={
              d.recours[0]
                ? {
                    dateDemande: d.recours[0].dateDemande ?? "",
                    dateReponse: d.recours[0].dateReponse ?? "",
                    decision: d.recours[0].decision ?? "en_cours",
                    saisineCapLe: d.recours[0].saisineCapLe ?? "",
                    avisCap: d.recours[0].avisCap ?? "",
                    commentaire: d.recours[0].commentaire ?? "",
                  }
                : null
            }
          />
        </div>
      )}
    </Coquille>
  );
}
