import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { enregistrerAgent, supprimerException } from "@/app/admin/actions";
import { Coquille } from "@/components/Entete";
import { BoutonCode, ChangerRedacteur, EditeurCircuit } from "@/components/EditeurCircuit";
import { SupprimerAgent } from "@/components/SupprimerAgent";

export const dynamic = "force-dynamic";

export default async function PageAgent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ campagne?: string; cree?: string }> }) {
  const u = await exigerAdmin();
  const id = Number((await params).id);
  const [a] = await db.select().from(schema.agents).where(eq(schema.agents.id, id));
  if (!a) notFound();
  const sp = await searchParams;
  const { toutes, choisie } = await campagneChoisie(sp.campagne);
  const tous = await db
    .select({ id: schema.agents.id, nom: schema.agents.nom, prenom: schema.agents.prenom, matricule: schema.agents.matricule })
    .from(schema.agents)
    .where(eq(schema.agents.actif, true))
    .orderBy(asc(schema.agents.nom));
  const personnes = tous.map((p) => ({ id: p.id, libelle: `${p.nom} ${p.prenom} (${p.matricule})` }));
  if (!personnes.find((p) => p.id === a.id)) personnes.push({ id: a.id, libelle: `${a.nom} ${a.prenom} (${a.matricule})` });

  const [dossier] = choisie
    ? await db.select().from(schema.entretiens).where(and(eq(schema.entretiens.campagneId, choisie.id), eq(schema.entretiens.agentId, a.id)))
    : [];
  const etapes = dossier ? await db.select().from(schema.etapes).where(eq(schema.etapes.entretienId, dossier.id)).orderBy(asc(schema.etapes.ordre)) : [];
  const historiqueDossiers = await db
    .select({ id: schema.entretiens.id, annee: schema.campagnes.annee, statut: schema.entretiens.statut })
    .from(schema.entretiens)
    .innerJoin(schema.campagnes, eq(schema.campagnes.id, schema.entretiens.campagneId))
    .where(eq(schema.entretiens.agentId, a.id));

  const champ = (nom: string, label: string, valeur: string | null) => (
    <div>
      <label className="etiquette" htmlFor={nom}>{label}</label>
      <input id={nom} name={nom} defaultValue={valeur ?? ""} className="champ" />
    </div>
  );

  return (
    <Coquille u={u}>
      <Link href="/admin/agents" className="text-sm text-gray-500 hover:underline">← Agents</Link>
      <h1 className="mb-4 mt-1 text-2xl font-bold">
        {a.nom} {a.prenom} <span className="text-base font-normal text-gray-500">· matricule {a.matricule}</span>
        {!a.actif && <span className="badge ml-2 bg-gray-100 align-middle text-gray-600">archivé / inactif</span>}
      </h1>
      {sp.cree && (
        <p className="mb-4 rounded-lg bg-sjr-primaire-doux p-3 text-sm text-sjr-primaire-fonce">
          ✓ Agent ajouté. Son code personnel provisoire est <strong className="font-mono tracking-widest">{a.codeProvisoire}</strong> (à lui remettre, ou imprimable depuis « Imprimer les codes »).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="titre-section mb-3">Fiche agent</h2>
          <p className="mb-3 text-xs text-gray-500">Ces informations sont mises à jour par l'import Inser/Ciril. Une correction manuelle sera écrasée au prochain import si le fichier source n'est pas corrigé.</p>
          <form action={enregistrerAgent} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="id" value={a.id} />
            {champ("nom", "Nom", a.nom)}
            {champ("prenom", "Prénom", a.prenom)}
            {champ("email", "E-mail", a.email)}
            <div>
              <label className="etiquette" htmlFor="collectivite">Collectivité</label>
              <select id="collectivite" name="collectivite" defaultValue={a.collectivite} className="champ"><option>Ville</option><option>CCAS</option></select>
            </div>
            {champ("statut", "Statut", a.statut)}
            {champ("grade", "Grade", a.grade)}
            {champ("poste", "Intitulé du poste", a.poste)}
            {champ("tempsTravail", "Temps de travail", a.tempsTravail)}
            <div className="text-xs text-gray-500 md:col-span-2">Service : {[a.niv3, a.niv4, a.niv5, a.niv6].filter(Boolean).join(" › ") || "—"}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="actif" defaultChecked={a.actif} /> Agent actif (peut se connecter)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isAdmin" defaultChecked={a.isAdmin} /> Administrateur RH</label>
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="horsCampagne" defaultChecked={a.horsCampagne} /> Non concerné par les entretiens (saisonnier, vacataire…) : aucun dossier créé automatiquement</label>
            <div className="md:col-span-2"><button className="btn-primaire">Enregistrer</button></div>
          </form>
          <hr className="my-4" />
          <h3 className="mb-2 text-sm font-bold">Accès</h3>
          <BoutonCode agentId={a.id} code={a.codeProvisoire} />
          {a.derniereConnexion && <p className="mt-2 text-xs text-gray-500">Dernière connexion : {a.derniereConnexion.toLocaleString("fr-FR")}</p>}
          {a.id !== u.id && (
            <>
              <hr className="my-4" />
              <h3 className="mb-2 text-sm font-bold text-red-700">Supprimer</h3>
              <SupprimerAgent id={a.id} nom={`${a.nom} ${a.prenom}`} />
            </>
          )}
        </section>

        <section className="carte p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="titre-section">Circuit de visas {choisie?.annee}</h2>
            {toutes.length > 1 && (
              <form className="flex gap-1" action={`/admin/agents/${a.id}`}>
                <select name="campagne" defaultValue={choisie?.id} className="champ w-auto py-1">{toutes.map((c) => <option key={c.id} value={c.id}>{c.annee}</option>)}</select>
                <button className="btn-secondaire py-1">OK</button>
              </form>
            )}
          </div>
          {a.circuitPersonnalise?.length ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-sjr-attente-doux p-3 text-sm text-yellow-900">
              <span className="flex-1">
                <strong>Circuit d'exception</strong> : il sera repris automatiquement aux prochaines campagnes au lieu du calcul par l'organigramme.
              </span>
              <form action={async () => { "use server"; await supprimerException(a.id); }}>
                <button className="btn-secondaire py-1 text-xs">Revenir au circuit automatique</button>
              </form>
            </div>
          ) : null}
          {choisie ? (
            <>
              <EditeurCircuit
                key={`${dossier?.id}-${dossier?.statut}-${etapes.map((e) => e.acteurId).join(",")}`}
                campagneId={choisie.id}
                annee={choisie.annee}
                agent={{ id: a.id, libelle: `${a.nom} ${a.prenom}` }}
                personnes={personnes}
                statut={dossier?.statut ?? null}
                entretienId={dossier?.id ?? null}
                redacteurId={dossier?.redacteurId ?? null}
                etapes={etapes.map((e) => ({ id: e.id, ordre: e.ordre, acteurId: e.acteurId, vise: !!e.viseLe }))}
              />
              {dossier?.statut === "redaction" && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-2 text-sm font-bold">Rédacteur (N+1) uniquement</h3>
                  <p className="mb-2 text-xs text-gray-500">Pour confier la rédaction à quelqu'un d'autre sans modifier le circuit (ex. N+1 absent ou parti).</p>
                  <ChangerRedacteur entretienId={dossier.id} personnes={personnes} actuel={dossier.redacteurId} />
                </div>
              )}
              {dossier && <Link href={`/entretiens/${dossier.id}`} className="mt-4 inline-block text-sm text-sjr-primaire-fonce hover:underline">Ouvrir le dossier {choisie.annee} →</Link>}
            </>
          ) : (
            <p className="text-sm text-gray-500">Aucune campagne.</p>
          )}
          {historiqueDossiers.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="mb-2 text-sm font-bold">Historique des entretiens</h3>
              <ul className="text-sm">
                {historiqueDossiers.sort((x, y) => y.annee - x.annee).map((h) => (
                  <li key={h.id}><Link className="text-sjr-primaire-fonce hover:underline" href={`/entretiens/${h.id}`}>{h.annee}</Link> – {h.statut === "termine" ? "terminé" : h.statut === "circuit" ? "en visa" : "en rédaction"}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </Coquille>
  );
}
