import Link from "next/link";
import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { actionImportAgents, actionImportCircuits } from "@/app/admin/actions";
import { Coquille } from "@/components/Entete";
import { FormImport } from "@/components/FormImport";

export const dynamic = "force-dynamic";

export default async function PageImport() {
  const u = await exigerAdmin();
  const { choisie } = await campagneChoisie();
  return (
    <Coquille u={u}>
      <h1 className="mb-1 text-2xl font-bold">Imports</h1>
      <p className="mb-6 text-sm text-gray-600">Deux fichiers, dans cet ordre. Les imports peuvent être relancés autant de fois que nécessaire : les agents sont mis à jour par matricule, rien n'est dupliqué.</p>
      <div className="space-y-6">
        <FormImport
          action={actionImportAgents}
          titre="① Base agents (export Inser / Ciril)"
          bouton="Importer les agents"
          description={
            <>
              Fichier <strong>.xlsx</strong> ou <strong>.csv</strong> avec la ligne d'en-têtes de l'export habituel. Colonnes utilisées : MATRICULE, NOM, PRENOM, EMAIL, STATUT, CATEGORIE, GRADE, FONCTION, METIER, TYPE TEMPS DE TRAVAIL, ECHELON, DATE D'ENTREE GRADE, CODE/LIBELLE NIVEAU 3 à 6, DATE DE DEPART.
              <br />
              <span className="text-xs text-gray-500">Les autres colonnes (salaires, adresse, date de naissance…) sont ignorées et jamais stockées. Un agent dont la date de départ est passée est désactivé. « CCAS » dans un libellé de service → collectivité CCAS.</span>
            </>
          }
        />
        {choisie ? (
          <FormImport
            action={actionImportCircuits}
            campagneId={choisie.id}
            titre={`② Circuits de visas – campagne ${choisie.annee}`}
            bouton="Importer les circuits"
            description={
              <>
                Format du fichier « Acteurs du workflow (Entretien) » : <em>Matricule de l'agent | Nom | Prénom | Code type entretien | Matricule acteur 1 | Nom | Matricule acteur 2 | Nom | …</em>
                <br />
                <span className="text-xs text-gray-500">Crée un dossier par agent (code EP) avec son circuit et reprend automatiquement les objectifs de l'an dernier. Un dossier déjà en cours de visa n'est pas modifié.</span>
              </>
            }
          />
        ) : (
          <div className="carte p-5 text-sm">Pour importer les circuits, <Link href="/admin/campagnes" className="text-sjr-vert-fonce underline">créez d'abord une campagne</Link>.</div>
        )}
      </div>
    </Coquille>
  );
}
