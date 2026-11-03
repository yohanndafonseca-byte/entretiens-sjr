import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { Coquille } from "@/components/Entete";
import { FormNouvelAgent } from "@/components/FormNouvelAgent";

export const dynamic = "force-dynamic";

export default async function PageNouvelAgent() {
  const u = await exigerAdmin();
  const agents = await db.select().from(schema.agents).where(eq(schema.agents.actif, true)).orderBy(asc(schema.agents.nom));
  const services = new Map<string, string>();
  for (const a of agents) {
    if (!a.niv3) continue;
    const cle = [a.niv3Code ?? "", a.niv3 ?? "", a.niv4Code ?? "", a.niv4 ?? ""].join("|");
    services.set(cle, [a.niv3, a.niv4 !== a.niv3 ? a.niv4 : null].filter(Boolean).join(" › "));
  }
  const { choisie } = await campagneChoisie();
  return (
    <Coquille u={u}>
      <Link href="/admin/agents" className="text-sm text-gray-500 hover:underline">← Agents</Link>
      <h1 className="mb-1 mt-1 text-2xl font-bold">Ajouter un agent</h1>
      <p className="mb-6 text-sm text-gray-600">Pour un agent arrivé entre deux exports. Pour un grand nombre d'agents, préférez l'import de l'export Inser / Ciril.</p>
      <FormNouvelAgent
        services={[...services.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([valeur, libelle]) => ({ valeur, libelle }))}
        responsables={agents.map((a) => ({ id: a.id, libelle: `${a.nom} ${a.prenom} (${a.matricule})${a.poste ? ` – ${a.poste}` : ""}` }))}
        campagne={choisie && choisie.statut === "ouverte" ? { id: choisie.id, annee: choisie.annee } : null}
      />
    </Coquille>
  );
}
