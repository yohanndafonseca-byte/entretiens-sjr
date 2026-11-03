import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { normaliserContenu } from "@/lib/formulaire";
import { exigerUtilisateur } from "@/lib/auth";
import { calculerDroits, chargerDossier, nomComplet } from "@/lib/dossier";
import { Coquille } from "@/components/Entete";
import { FormulaireCR } from "@/components/FormulaireCR";
import { PanneauCircuit } from "@/components/PanneauCircuit";
import { BadgeStatut } from "@/components/Badges";
import { CarteConvocation } from "@/components/CarteConvocation";

export const dynamic = "force-dynamic";

export default async function PageEntretien({ params }: { params: Promise<{ id: string }> }) {
  const { id: idTxt } = await params;
  const id = Number(idTxt);
  const u = await exigerUtilisateur();
  const d = Number.isFinite(id) ? await chargerDossier(id) : null;
  if (!d) notFound();
  const droits = calculerDroits(u, d);
  if (!droits.voir) notFound();
  const [prec] = await db
    .select({ contenu: schema.entretiens.contenu, annee: schema.campagnes.annee })
    .from(schema.entretiens)
    .innerJoin(schema.campagnes, eq(schema.campagnes.id, schema.entretiens.campagneId))
    .where(and(eq(schema.entretiens.agentId, d.agent.id), lt(schema.campagnes.annee, d.campagne.annee)))
    .orderBy(desc(schema.campagnes.annee))
    .limit(1);
  const precedent = prec?.contenu
    ? { annee: prec.annee, notes: Object.fromEntries(Object.entries(normaliserContenu(prec.contenu).criteres).map(([k, v]) => [k, v.note])) }
    : null;

  const snap = d.snapshot;
  const e = d.entretien;
  const derniere = d.etapes[d.etapes.length - 1];
  const libelle =
    e.statut === "redaction" ? "En rédaction" : e.statut === "termine" ? "Terminé" : `En attente du visa de ${nomComplet(d.etapeCourante?.acteur)}`;

  // L'agent ne voit son compte rendu qu'une fois visé par son N+1
  const masquerPourAgent = droits.estAgent && e.statut === "redaction" && !u.isAdmin;
  const limiteNotification =
    e.statut === "redaction" && (e.dateEntretien || e.convocationLe)
      ? new Date(new Date(`${(e.dateEntretien ?? e.convocationLe!).slice(0, 10)}T12:00:00`).getTime() + 15 * 86_400_000).toISOString().slice(0, 10)
      : null;
  const convocation = (
    <CarteConvocation
      id={id}
      peutConvoquer={droits.editer}
      convocationLe={e.convocationLe}
      lieu={e.convocationLieu}
      envoyeeLe={e.convocationEnvoyeeLe ? e.convocationEnvoyeeLe.toISOString() : null}
      fichePosteNom={e.fichePosteNom}
      agentAEmail={!!d.agent.email}
      limiteNotification={droits.editer ? limiteNotification : null}
      enRedaction={e.statut === "redaction"}
    />
  );

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
        <div className="mx-auto max-w-xl space-y-4">
          {convocation}
          <div className="carte p-8 text-center text-gray-600">
            Après l'entretien, votre responsable rédige le compte rendu. Vous serez prévenu(e) dès qu'il sera prêt à être visé.
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <FormulaireCR
              key={e.convocationLe ?? "sans-convocation"}
              id={id}
              editable={droits.editer}
              contenuInitial={d.contenu}
              dateInitiale={e.dateEntretien ?? e.convocationLe?.slice(0, 10) ?? null}
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
              precedent={precedent}
            />
          </div>
          <div className="space-y-4">
          {convocation}
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
        </div>
      )}
    </Coquille>
  );
}
