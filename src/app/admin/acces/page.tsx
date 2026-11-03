import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { estSansOutil } from "@/lib/acces";
import { Coquille } from "@/components/Entete";
import { Tuile } from "@/components/Graph";
import { RenouvelerCodes } from "@/components/RenouvelerCodes";

export const dynamic = "force-dynamic";

export default async function PageAcces({ searchParams }: { searchParams: Promise<{ direction?: string }> }) {
  const u = await exigerAdmin();
  const sp = await searchParams;
  const { choisie } = await campagneChoisie();
  const actifs = (await db.select().from(schema.agents).where(eq(schema.agents.actif, true)).orderBy(asc(schema.agents.nom))).filter((a) => !a.horsCampagne);
  const sansOutil = actifs.filter(estSansOutil);
  const connectes = actifs.filter((a) => !estSansOutil(a));
  const debutCampagne = choisie?.createdAt ?? new Date(0);
  const aJour = sansOutil.filter((a) => a.codeGenereLe && a.codeGenereLe >= debutCampagne);
  const directions = [...new Set(sansOutil.map((a) => a.niv3 ?? ""))].filter(Boolean).sort();
  const liste = sansOutil.filter((a) => !sp.direction || a.niv3 === sp.direction);
  return (
    <Coquille u={u}>
      <h1 className="mb-1 text-2xl font-bold">Accès des agents</h1>
      <p className="mb-6 max-w-3xl text-sm text-gray-600">
        Deux profils : les agents <strong>connectés</strong> (ils ont un e-mail et gèrent leur mot de passe seuls) et les agents <strong>sans outil informatique</strong>, qui reçoivent un nouveau code à chaque campagne.
        Le profil est déduit de l'e-mail ; il peut être forcé sur la fiche de l'agent.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tuile titre="Sans outil informatique" valeur={sansOutil.length} accent />
        <Tuile titre="Codes à jour" valeur={`${aJour.length} / ${sansOutil.length}`} detail={choisie ? `générés depuis la création de la campagne ${choisie.annee}` : undefined} />
        <Tuile titre="Connectés (e-mail)" valeur={connectes.length} detail="mot de passe oublié : en autonomie" />
        <Tuile titre="Jamais connectés" valeur={connectes.filter((a) => !a.derniereConnexion).length} detail="parmi les connectés" />
      </div>
      <div className="mb-6">
        <RenouvelerCodes nb={sansOutil.length} directions={directions} annee={choisie?.annee ?? null} />
      </div>
      <section className="carte overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-sjr-ligne px-4 py-3">
          <h2 className="titre-section flex-1">Agents sans outil informatique ({liste.length})</h2>
          <form className="flex gap-2" action="/admin/acces">
            <select name="direction" defaultValue={sp.direction ?? ""} className="champ w-auto py-1.5">
              <option value="">Toutes les directions</option>
              {directions.map((d) => <option key={d}>{d}</option>)}
            </select>
            <button className="btn-secondaire py-1.5">Filtrer</button>
          </form>
          <a className="btn-primaire py-1.5" href={`/api/export/codes${sp.direction ? `?direction=${encodeURIComponent(sp.direction)}` : ""}`} target="_blank" rel="noreferrer">🖨 Fiches à découper (PDF)</a>
        </div>
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead><tr><th>Agent</th><th>Service</th><th>Code</th><th>Généré le</th><th>Dernière connexion</th><th></th></tr></thead>
            <tbody>
              {liste.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.nom} {a.prenom}<div className="text-xs text-gray-400">{a.matricule}</div></td>
                  <td className="text-xs text-gray-600">{a.niv4 ?? a.niv3}</td>
                  <td>{a.codeProvisoire ? <span className="badge bg-sjr-attente-doux text-yellow-900">à remettre</span> : <span className="badge bg-sjr-primaire-doux text-sjr-primaire-fonce">remplacé par l'agent</span>}</td>
                  <td className="text-xs">
                    {a.codeGenereLe ? a.codeGenereLe.toLocaleDateString("fr-FR") : "—"}
                    {!a.codeGenereLe || a.codeGenereLe < debutCampagne ? <span className="ml-1 text-red-700">(à renouveler)</span> : null}
                  </td>
                  <td className="text-xs">{a.derniereConnexion ? a.derniereConnexion.toLocaleDateString("fr-FR") : "jamais"}</td>
                  <td className="text-right"><Link href={`/admin/agents/${a.id}`} className="btn-secondaire py-1 text-xs">Fiche</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Coquille>
  );
}
