import Link from "next/link";
import { exigerUtilisateur } from "@/lib/auth";
import { entretiensDe, libelleEtape, type LigneListe } from "@/lib/dossier";
import { Coquille } from "@/components/Entete";
import { BadgeStatut, Progression, joursDepuis } from "@/components/Badges";

export const dynamic = "force-dynamic";

function Tableau({ lignes, vide, montrerAgent = true }: { lignes: LigneListe[]; vide: string; montrerAgent?: boolean }) {
  if (!lignes.length) return <p className="px-4 py-6 text-sm text-gray-500">{vide}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tableau">
        <thead>
          <tr>
            {montrerAgent && <th>Agent</th>}
            <th>Campagne</th>
            <th>Étape</th>
            <th>Avancement</th>
            <th>En attente de</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id} className="hover:bg-gray-50">
              {montrerAgent && (
                <td>
                  <div className="font-medium">{l.agentNom} {l.agentPrenom}</div>
                  <div className="text-xs text-gray-500">{l.service}</div>
                </td>
              )}
              <td>{l.annee}</td>
              <td><BadgeStatut statut={l.statut} libelle={libelleEtape(l)} /></td>
              <td><Progression index={l.etapeIndex} total={l.nbEtapes} /></td>
              <td className="text-gray-600">
                {l.acteurCourantNom}
                {l.statut !== "termine" && <span className="ml-1 text-xs text-gray-400">· {joursDepuis(l.derniereActionLe)} j</span>}
              </td>
              <td className="text-right"><Link href={`/entretiens/${l.id}`} className="btn-secondaire py-1">Ouvrir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Accueil() {
  const u = await exigerUtilisateur();
  const { lignes } = await entretiensDe(u.id);
  const aTraiter = lignes.filter((l) => l.statut !== "termine" && l.acteurCourantId === u.id);
  const aViserSerie = aTraiter.filter((l) => l.statut === "circuit" && l.agentId !== u.id).length;
  const mesEntretiens = lignes.filter((l) => l.agentId === u.id).sort((a, b) => b.annee - a.annee);
  const equipe = lignes.filter((l) => l.agentId !== u.id && !aTraiter.includes(l));
  const enCours = equipe.filter((l) => l.statut !== "termine");
  const termines = equipe.filter((l) => l.statut === "termine");

  return (
    <Coquille u={u}>
      <h1 className="mb-1 text-2xl font-bold">Bonjour {u.prenom}</h1>
      <p className="mb-6 text-sm text-gray-600">
        {aTraiter.length
          ? `Vous avez ${aTraiter.length} dossier${aTraiter.length > 1 ? "s" : ""} à traiter.`
          : "Aucun dossier n'attend d'action de votre part."}
      </p>

      {aViserSerie > 1 && (
        <Link href="/visas" className="carte mb-6 flex items-center gap-4 border-l-4 border-l-sjr-primaire p-4 transition hover:shadow-md">
          <span className="text-2xl">✍️</span>
          <span className="flex-1">
            <span className="block font-bold">{aViserSerie} comptes rendus attendent votre visa</span>
            <span className="text-sm text-gray-600">Parcourez les résumés et visez-les en série.</span>
          </span>
          <span className="btn-primaire">Viser en série →</span>
        </Link>
      )}

      <section className="carte mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 bg-sjr-attente-doux px-4 py-3">
          <h2 className="titre-section">À traiter <span className="ml-1 badge bg-white text-gray-700">{aTraiter.length}</span></h2>
        </div>
        <Tableau lignes={aTraiter} vide="Rien à faire pour le moment." />
      </section>

      {mesEntretiens.length > 0 && (
        <section className="carte mb-6 overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3"><h2 className="titre-section">Mes entretiens</h2></div>
          <Tableau lignes={mesEntretiens} vide="" montrerAgent={false} />
        </section>
      )}

      {enCours.length > 0 && (
        <section className="carte mb-6 overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="titre-section">Mon équipe – en cours <span className="ml-1 badge bg-gray-100 text-gray-700">{enCours.length}</span></h2>
          </div>
          <Tableau lignes={enCours} vide="" />
        </section>
      )}

      {termines.length > 0 && (
        <details className="carte mb-6 overflow-hidden">
          <summary className="cursor-pointer border-b border-gray-100 px-4 py-3 font-bold">
            Mon équipe – terminés <span className="ml-1 badge bg-sjr-primaire-doux text-sjr-primaire-fonce">{termines.length}</span>
          </summary>
          <Tableau lignes={termines} vide="" />
        </details>
      )}
    </Coquille>
  );
}
