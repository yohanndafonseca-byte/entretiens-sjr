import type { Campagne } from "@/db/schema";

export function SelecteurCampagne({ campagnes, choisie, action }: { campagnes: Campagne[]; choisie: Campagne | null; action: string }) {
  if (!campagnes.length) return null;
  return (
    <form action={action} className="flex items-center gap-2 text-sm">
      <label htmlFor="campagne" className="text-gray-500">Campagne</label>
      <select id="campagne" name="campagne" defaultValue={choisie?.id} className="champ w-auto py-1.5">
        {campagnes.map((c) => (
          <option key={c.id} value={c.id}>{c.annee} – {c.titre}{c.statut === "close" ? " (close)" : ""}</option>
        ))}
      </select>
      <button className="btn-secondaire py-1.5">Afficher</button>
    </form>
  );
}
