import Link from "next/link";
import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { actionImportAgents, actionImportCircuits } from "@/app/admin/actions";
import { Coquille } from "@/components/Entete";
import { FormImport } from "@/components/FormImport";
import { GenerateurDossiers } from "@/components/GenerateurDossiers";

export const dynamic = "force-dynamic";

export default async function PageImport() {
  const u = await exigerAdmin();
  const { choisie } = await campagneChoisie();
  const precedente = choisie
    ? await db.select({ id: schema.campagnes.id }).from(schema.campagnes).where(lt(schema.campagnes.annee, choisie.annee)).limit(1)
    : [];
  const [viseur] = choisie?.viseurFinalId
    ? await db.select().from(schema.agents).where(and(eq(schema.agents.id, choisie.viseurFinalId)))
    : [];
  return (
    <Coquille u={u}>
      <h1 className="mb-1 text-2xl font-bold">Agents et dossiers</h1>
      <p className="mb-6 text-sm text-gray-600">Deux étapes, dans cet ordre. Chacune affiche d'abord un aperçu : rien n'est modifié avant votre validation.</p>
      <div className="space-y-6">
        <FormImport
          action={actionImportAgents}
          avecApercu
          titre="① Mettre à jour la base agents (export Inser / Ciril)"
          bouton="Importer"
          description={
            <>
              Déposez l'export agents habituel (<strong>.xlsx</strong> ou <strong>.csv</strong>), sans le retoucher. Les agents sont mis à jour par matricule : vous pouvez réimporter autant de fois que nécessaire.
              <br />
              <span className="text-xs text-gray-500">
                Seules les colonnes utiles sont lues (identité, service, grade, poste, statut, e-mail, responsables des niveaux 3 à 6, date de départ). Salaires, adresse et date de naissance ne sont jamais enregistrés. Une date de départ passée désactive l'agent.
              </span>
            </>
          }
        />
        {choisie ? (
          <>
            <GenerateurDossiers campagneId={choisie.id} annee={choisie.annee} aUnePrecedente={precedente.length > 0} viseurFinal={viseur ? `${viseur.nom} ${viseur.prenom}` : null} />
            <details className="carte p-5">
              <summary className="cursor-pointer font-bold">Autre méthode : importer le fichier de circuits d'Inser</summary>
              <div className="mt-4">
                <FormImport
                  action={actionImportCircuits}
                  campagneId={choisie.id}
                  titre={`Fichier « Acteurs du workflow (Entretien) » – campagne ${choisie.annee}`}
                  bouton="Importer les circuits"
                  description={<>Format : <em>Matricule de l'agent | Nom | Prénom | Code type entretien | Matricule acteur 1 | Nom | Matricule acteur 2 | Nom | …</em>. Utile la première année, ou si l'organigramme de l'export n'est pas fiable.</>}
                />
              </div>
            </details>
          </>
        ) : (
          <div className="carte p-5 text-sm">Pour créer les dossiers, <Link href="/admin/campagnes" className="text-sjr-primaire-fonce underline">créez d'abord une campagne</Link>.</div>
        )}
      </div>
    </Coquille>
  );
}
