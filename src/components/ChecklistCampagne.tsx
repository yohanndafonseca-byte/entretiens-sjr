import Link from "next/link";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Campagne } from "@/db/schema";

type Etape = { ok: boolean; titre: string; detail: string; lien: string; action: string; facultatif?: boolean };

/** Liste de contrôle « Prêt à lancer la campagne » : ce qui est fait, ce qui reste, et où cliquer. */
export async function ChecklistCampagne({ c, compacte = false }: { c: Campagne; compacte?: boolean }) {
  const [{ actifs }] = await db.select({ actifs: sql<number>`count(*)` }).from(schema.agents).where(and(eq(schema.agents.actif, true), eq(schema.agents.horsCampagne, false)));
  const [{ dossiers }] = await db.select({ dossiers: sql<number>`count(*)` }).from(schema.entretiens).where(eq(schema.entretiens.campagneId, c.id));
  const [dernierImport] = await db
    .select({ at: schema.historique.at })
    .from(schema.historique)
    .where(eq(schema.historique.action, "Import agents"))
    .orderBy(desc(schema.historique.at))
    .limit(1);
  const sansOutil = (await db.select().from(schema.agents).where(and(eq(schema.agents.actif, true), eq(schema.agents.horsCampagne, false)))).filter(
    (a) => a.profilAcces === "sans_outil" || (a.profilAcces === "auto" && !a.email),
  );
  const codesAnciens = sansOutil.filter((a) => !a.codeGenereLe || a.codeGenereLe < c.createdAt).length;
  const directions = await db.selectDistinct({ code: schema.agents.niv3Code }).from(schema.agents).where(and(eq(schema.agents.actif, true), isNotNull(schema.agents.niv3Code)));
  const objs = await db.select().from(schema.objectifsServices).where(and(eq(schema.objectifsServices.campagneId, c.id), eq(schema.objectifsServices.niveau, 3)));
  const objsOk = objs.filter((o) => o.texte.trim()).length;

  const etapes: Etape[] = [
    {
      ok: !!(c.dateLimite && c.objectifsVille.trim() && c.viseurFinalId),
      titre: "Paramétrer la campagne",
      detail: [!c.dateLimite && "date limite", !c.objectifsVille.trim() && "objectifs de la Ville", !c.viseurFinalId && "dernier visa (DGS)"].filter(Boolean).join(", ") || "Dates, objectifs de la Ville et dernier visa définis",
      lien: `/admin/campagnes/${c.id}`,
      action: "Paramétrer",
    },
    {
      ok: !!dernierImport && Date.now() - dernierImport.at.getTime() < 30 * 86_400_000,
      titre: "Mettre à jour la base agents",
      detail: dernierImport ? `Dernier import le ${dernierImport.at.toLocaleDateString("fr-FR")} · ${actifs} agents concernés` : "Aucun import pour l'instant",
      lien: "/admin/import",
      action: "Importer",
    },
    {
      ok: directions.length > 0 && objsOk >= directions.length,
      facultatif: true,
      titre: "Saisir les objectifs des directions",
      detail: `${objsOk} / ${directions.length} direction(s) renseignée(s)`,
      lien: `/admin/campagnes/${c.id}`,
      action: "Saisir",
    },
    {
      ok: dossiers > 0 && dossiers >= actifs * 0.9,
      titre: "Créer les dossiers et leurs circuits",
      detail: `${dossiers} dossier(s) créé(s) pour ${actifs} agent(s) concerné(s)`,
      lien: "/admin/import",
      action: "Créer",
    },
    {
      ok: codesAnciens === 0,
      titre: "Renouveler les codes des agents sans outil informatique",
      detail: codesAnciens
        ? `${codesAnciens} / ${sansOutil.length} agent(s) ont encore le code d'une campagne précédente`
        : `${sansOutil.length} code(s) à jour pour cette campagne (envoyés aux responsables, et imprimés sur les convocations)`,
      lien: "/admin/acces",
      action: "Renouveler",
    },
    {
      ok: !!process.env.SMTP_HOST,
      titre: "Activer l'envoi des e-mails",
      detail: process.env.SMTP_HOST ? "Serveur d'envoi configuré" : "Non configuré : les e-mails sont seulement enregistrés (voir guide de maintenance § 4)",
      lien: "/admin/emails",
      action: "Voir",
    },
  ];
  const faits = etapes.filter((e) => e.ok).length;
  if (compacte && etapes.every((e) => e.ok || e.facultatif)) return null;

  return (
    <section className="carte mb-6 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="titre-section">Lancement de la campagne {c.annee}</h2>
        <span className="text-sm text-gray-500">{faits} / {etapes.length} étapes</span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-sjr-primaire" style={{ width: `${(faits / etapes.length) * 100}%` }} />
      </div>
      <ol className="space-y-2">
        {etapes.map((e, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg border border-sjr-ligne p-3">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${e.ok ? "bg-sjr-primaire text-white" : "bg-gray-100 text-gray-500"}`}>{e.ok ? "✓" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{e.titre}{e.facultatif && <span className="ml-1 text-xs font-normal text-gray-400">(facultatif)</span>}</div>
              <div className="text-xs text-gray-500">{e.detail}</div>
            </div>
            {!e.ok && <Link href={e.lien} className="btn-secondaire py-1 text-xs">{e.action} →</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}
