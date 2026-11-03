import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { Coquille } from "@/components/Entete";

export const dynamic = "force-dynamic";

export default async function PageAgents({ searchParams }: { searchParams: Promise<{ q?: string; filtre?: string }> }) {
  const u = await exigerAdmin();
  const sp = await searchParams;
  const { choisie } = await campagneChoisie();
  const agents = await db.select().from(schema.agents).orderBy(asc(schema.agents.nom), asc(schema.agents.prenom));
  const dossiers = choisie
    ? await db.select({ agentId: schema.entretiens.agentId, id: schema.entretiens.id, statut: schema.entretiens.statut }).from(schema.entretiens).where(eq(schema.entretiens.campagneId, choisie.id))
    : [];
  const dossierDe = new Map(dossiers.map((d) => [d.agentId, d]));
  const q = (sp.q ?? "").toLowerCase().trim();
  const liste = agents
    .filter((a) => !q || `${a.nom} ${a.prenom} ${a.matricule} ${a.niv3 ?? ""} ${a.niv4 ?? ""}`.toLowerCase().includes(q))
    .filter((a) =>
      sp.filtre === "sansemail" ? !a.email && a.actif
      : sp.filtre === "sansdossier" ? a.actif && !dossierDe.has(a.id)
      : sp.filtre === "inactifs" ? !a.actif
      : sp.filtre === "admins" ? a.isAdmin
      : sp.filtre === "codes" ? !!a.codeProvisoire && a.actif
      : true,
    );

  const filtres = [
    ["", "Tous"],
    ["sansdossier", `Sans dossier ${choisie?.annee ?? ""}`],
    ["sansemail", "Sans e-mail"],
    ["codes", "Jamais connectés (code provisoire)"],
    ["inactifs", "Partis / inactifs"],
    ["admins", "Administrateurs RH"],
  ];

  return (
    <Coquille u={u}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Agents & circuits</h1>
        <div className="flex gap-2">
          <Link href="/admin/agents/codes" className="btn-secondaire">Imprimer les codes provisoires</Link>
          <Link href="/admin/import" className="btn-primaire">Importer</Link>
        </div>
      </div>
      <form className="mb-3 flex flex-wrap gap-2" action="/admin/agents">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Nom, matricule, service…" className="champ max-w-xs" />
        <select name="filtre" defaultValue={sp.filtre ?? ""} className="champ w-auto">
          {filtres.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-secondaire">Filtrer</button>
      </form>
      <div className="carte overflow-x-auto">
        <table className="tableau">
          <thead><tr><th>Agent</th><th>Matricule</th><th>Service</th><th>Statut</th><th>E-mail</th><th>Dossier {choisie?.annee}</th><th></th></tr></thead>
          <tbody>
            {liste.map((a) => {
              const d = dossierDe.get(a.id);
              return (
                <tr key={a.id} className={a.actif ? "" : "opacity-50"}>
                  <td className="font-medium">{a.nom} {a.prenom} {a.isAdmin && <span className="badge ml-1 bg-sjr-primaire-doux text-sjr-primaire-fonce">RH</span>}</td>
                  <td>{a.matricule}</td>
                  <td className="text-xs text-gray-600">{a.niv3}<br />{a.niv4}</td>
                  <td className="text-xs">{a.collectivite} · {a.statut ?? "—"}</td>
                  <td className="text-xs">{a.email ?? <span className="text-gray-400">—</span>}</td>
                  <td className="text-xs">{d ? <Link className="text-sjr-primaire-fonce hover:underline" href={`/entretiens/${d.id}`}>{d.statut === "termine" ? "Terminé" : d.statut === "circuit" ? "En visa" : "En rédaction"}</Link> : <span className="text-gray-400">—</span>}</td>
                  <td className="text-right"><Link href={`/admin/agents/${a.id}`} className="btn-secondaire py-1 text-xs">Gérer</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!liste.length && <p className="p-6 text-sm text-gray-500">Aucun agent.</p>}
      </div>
    </Coquille>
  );
}
