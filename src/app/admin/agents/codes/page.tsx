import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { urlApp } from "@/lib/emails";
import { BoutonImprimer } from "@/components/BoutonImprimer";

export const dynamic = "force-dynamic";

/** Fiches à découper et remettre aux agents (un code personnel par agent). */
export default async function PageCodes({ searchParams }: { searchParams: Promise<{ direction?: string }> }) {
  await exigerAdmin();
  const sp = await searchParams;
  const agents = await db
    .select()
    .from(schema.agents)
    .where(and(isNotNull(schema.agents.codeProvisoire), eq(schema.agents.actif, true)))
    .orderBy(asc(schema.agents.niv3), asc(schema.agents.nom));
  const directions = [...new Set(agents.map((a) => a.niv3 ?? ""))].filter(Boolean).sort();
  const liste = agents.filter((a) => !sp.direction || a.niv3 === sp.direction);
  return (
    <main className="mx-auto max-w-4xl p-6 print:p-0">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <a href="/admin/agents" className="text-sm text-gray-500 hover:underline">← Retour</a>
        <h1 className="text-xl font-bold">Codes provisoires ({liste.length})</h1>
        <form className="flex gap-2" action="/admin/agents/codes">
          <select name="direction" defaultValue={sp.direction ?? ""} className="champ w-auto">
            <option value="">Toutes les directions</option>
            {directions.map((d) => <option key={d}>{d}</option>)}
          </select>
          <button className="btn-secondaire">Filtrer</button>
        </form>
        <BoutonImprimer />
      </div>
      <p className="mb-4 text-sm text-gray-500 print:hidden">Seuls les agents qui ne se sont jamais connectés apparaissent (le code disparaît dès qu'ils choisissent leur mot de passe).</p>
      <div className="grid grid-cols-2 gap-0">
        {liste.map((a) => (
          <div key={a.id} className="break-inside-avoid border border-dashed border-gray-400 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-sjr.png" alt="" className="h-8 w-8" />
              <div className="font-bold">Entretiens professionnels</div>
            </div>
            <div className="font-semibold">{a.nom} {a.prenom}</div>
            <div className="text-xs text-gray-500">{a.niv4 ?? a.niv3}</div>
            <div className="mt-2">Adresse : <strong>{urlApp().replace(/^https?:\/\//, "")}</strong></div>
            <div>Matricule : <strong>{a.matricule}</strong></div>
            <div>Code personnel : <strong className="font-mono text-base tracking-widest">{a.codeProvisoire}</strong></div>
            <div className="mt-1 text-xs text-gray-500">À la 1re connexion, vous choisirez votre propre mot de passe. Ce code permet aussi de viser votre compte rendu sur le poste de votre responsable.</div>
          </div>
        ))}
      </div>
    </main>
  );
}
