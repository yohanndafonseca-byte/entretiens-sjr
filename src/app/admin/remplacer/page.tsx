import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { Coquille } from "@/components/Entete";
import { Remplacer } from "@/components/Remplacer";

export const dynamic = "force-dynamic";

export default async function PageRemplacer() {
  const u = await exigerAdmin();
  const tous = await db.select().from(schema.agents).orderBy(asc(schema.agents.nom));
  return (
    <Coquille u={u}>
      <h1 className="mb-1 text-2xl font-bold">Remplacer une personne partout</h1>
      <p className="mb-6 text-sm text-gray-600">Départ, mutation, longue absence d'un responsable : remplacez-le en une fois dans tous les circuits.</p>
      <Remplacer personnes={tous.map((p) => ({ id: p.id, libelle: `${p.nom} ${p.prenom} (${p.matricule})${p.actif ? "" : " – inactif"}` }))} />
    </Coquille>
  );
}
