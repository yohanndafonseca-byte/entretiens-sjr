import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { lignesListe } from "@/lib/dossier";
import { normaliserContenu, RUBRIQUES } from "@/lib/formulaire";
import { Coquille } from "@/components/Entete";
import { BarreEmpilee, Legende, RAMPE, Tuile } from "@/components/Graph";
import { SelecteurCampagne } from "@/components/SelecteurCampagne";
import { joursDepuis } from "@/components/Badges";

export const dynamic = "force-dynamic";

const ETATS = [
  { label: "En rédaction", couleur: RAMPE.clair },
  { label: "En cours de visa", couleur: RAMPE.moyen },
  { label: "Terminés", couleur: RAMPE.fonce },
];
const NIVEAUX = [
  { label: "Exigences non satisfaites", couleur: RAMPE.clair },
  { label: "Améliorations à rechercher", couleur: RAMPE.moyen },
  { label: "Exigences satisfaites", couleur: RAMPE.fonce },
  { label: "Sans objet", couleur: RAMPE.neutre, motif: true },
];

export default async function TableauDeBord({ searchParams }: { searchParams: Promise<{ campagne?: string }> }) {
  const u = await exigerAdmin();
  const { toutes, choisie } = await campagneChoisie((await searchParams).campagne);

  if (!choisie)
    return (
      <Coquille u={u}>
        <div className="carte p-8 text-center">
          <h1 className="mb-2 text-xl font-bold">Bienvenue dans l'espace RH</h1>
          <p className="mb-4 text-gray-600">Commencez par créer la campagne de l'année, puis importez les agents et les circuits de visas.</p>
          <Link href="/admin/campagnes" className="btn-primaire">Créer une campagne</Link>
        </div>
      </Coquille>
    );

  const lignes = await lignesListe(undefined, choisie.id);
  const contenus = await db
    .select({ contenu: schema.entretiens.contenu, statut: schema.entretiens.statut })
    .from(schema.entretiens)
    .where(eq(schema.entretiens.campagneId, choisie.id));
  const rediges = contenus.filter((c) => c.statut !== "redaction").map((c) => normaliserContenu(c.contenu));
  const nbRec = await db
    .select({ id: schema.recours.id })
    .from(schema.recours)
    .innerJoin(schema.entretiens, eq(schema.entretiens.id, schema.recours.entretienId))
    .where(eq(schema.entretiens.campagneId, choisie.id));

  const total = lignes.length;
  const nRed = lignes.filter((l) => l.statut === "redaction").length;
  const nCirc = lignes.filter((l) => l.statut === "circuit").length;
  const nTerm = lignes.filter((l) => l.statut === "termine").length;
  const pct = total ? Math.round((nTerm / total) * 100) : 0;
  const seuil = choisie.relanceJours;
  const enRetard = lignes.filter((l) => l.statut !== "termine" && joursDepuis(l.derniereActionLe) >= seuil);

  // Avancement par direction
  const parDir = new Map<string, { red: number; circ: number; term: number }>();
  for (const l of lignes) {
    const k = l.niv3 || "Sans direction";
    const v = parDir.get(k) ?? { red: 0, circ: 0, term: 0 };
    if (l.statut === "redaction") v.red++;
    else if (l.statut === "circuit") v.circ++;
    else v.term++;
    parDir.set(k, v);
  }
  const directions = [...parDir.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Qui bloque ?
  const bloq = new Map<number, { nom: string; nb: number; max: number }>();
  for (const l of lignes.filter((x) => x.statut !== "termine" && x.acteurCourantId)) {
    const v = bloq.get(l.acteurCourantId!) ?? { nom: l.acteurCourantNom, nb: 0, max: 0 };
    v.nb++;
    v.max = Math.max(v.max, joursDepuis(l.derniereActionLe));
    bloq.set(l.acteurCourantId!, v);
  }
  const bloqueurs = [...bloq.entries()].filter(([, v]) => v.max >= seuil).sort((a, b) => b[1].max - a[1].max || b[1].nb - a[1].nb).slice(0, 10);

  // Appréciations
  const distrib = RUBRIQUES.flatMap((r) => r.groupes.flatMap((g) => g.criteres)).map((k) => {
    const n = [0, 0, 0, 0, 0];
    for (const c of rediges) {
      const v = c.criteres[k.id]?.note;
      if (v) n[v]++;
    }
    return { k, n, tot: n[1] + n[2] + n[3] + n[4] };
  });

  const besoins = rediges.reduce((s, c) => s + c.besoinsFormation.filter((b) => b.catalogue.trim() || b.besoin.trim()).length, 0);
  const mobInt = rediges.filter((c) => c.voeux.changementInterne.souhait === "Oui").length;
  const mobExt = rediges.filter((c) => c.voeux.changementExterne.souhait === "Oui").length;
  const evol = rediges.filter((c) => c.voeux.evolutionPoste.souhait === "Oui").length;

  return (
    <Coquille u={u}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord – campagne {choisie.annee}</h1>
          <p className="text-sm text-gray-500">
            {choisie.dateLimite ? `Date limite : ${choisie.dateLimite.split("-").reverse().join("/")} · ` : ""}relance automatique après {seuil} jours sans action
          </p>
        </div>
        <SelecteurCampagne campagnes={toutes} choisie={choisie} action="/admin" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Tuile titre="Dossiers" valeur={total} accent />
        <Tuile titre="En rédaction" valeur={nRed} />
        <Tuile titre="En cours de visa" valeur={nCirc} />
        <Tuile titre="Terminés" valeur={`${nTerm}`} detail={`${pct} % de la campagne`} />
        <Tuile titre="En retard" valeur={enRetard.length} detail={`sans action depuis ${seuil} j ou plus`} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="carte p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="titre-section">Avancement par direction</h2>
            <Legende items={ETATS} />
          </div>
          <div className="space-y-3">
            {directions.map(([nom, v]) => {
              const t = v.red + v.circ + v.term;
              return (
                <div key={nom}>
                  <div className="mb-1 flex justify-between text-xs">
                    <Link href={`/admin/dossiers?campagne=${choisie.id}&direction=${encodeURIComponent(nom)}`} className="font-medium hover:underline">{nom}</Link>
                    <span className="text-gray-500">{v.term} / {t} terminés</span>
                  </div>
                  <BarreEmpilee
                    total={t}
                    segments={[
                      { ...ETATS[0], valeur: v.red },
                      { ...ETATS[1], valeur: v.circ },
                      { ...ETATS[2], valeur: v.term },
                    ]}
                  />
                </div>
              );
            })}
            {!directions.length && <p className="text-sm text-gray-500">Aucun dossier : importez les circuits de visas.</p>}
          </div>
        </section>

        <section className="carte p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="titre-section">Qui bloque ?</h2>
            <Link href={`/admin/dossiers?campagne=${choisie.id}&retard=1`} className="text-sm text-sjr-vert-fonce hover:underline">Relancer les retardataires →</Link>
          </div>
          {bloqueurs.length ? (
            <table className="tableau">
              <thead><tr><th>Personne</th><th className="text-right">Dossiers en attente</th><th className="text-right">Plus ancien</th></tr></thead>
              <tbody>
                {bloqueurs.map(([id, v]) => (
                  <tr key={id}>
                    <td><Link href={`/admin/dossiers?campagne=${choisie.id}&attente=${id}`} className="hover:underline">{v.nom}</Link></td>
                    <td className="text-right">{v.nb}</td>
                    <td className="text-right font-medium">{v.max} j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Personne n'est en retard. 👍</p>
          )}
        </section>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Tuile titre="Besoins de formation" valeur={besoins} detail="exprimés dans les CR visés" />
        <Tuile titre="Évolution sur le poste" valeur={evol} detail="agents demandeurs" />
        <Tuile titre="Mobilité interne" valeur={mobInt} detail="agents demandeurs" />
        <Tuile titre="Mobilité externe" valeur={mobExt} detail="agents demandeurs" />
        <Tuile titre="Recours" valeur={nbRec.length} detail="demandes de révision" />
      </div>

      <section className="carte p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="titre-section">Appréciations par critère</h2>
          <Legende items={NIVEAUX} />
        </div>
        <p className="mb-4 text-xs text-gray-500">Sur les {rediges.length} comptes rendus visés par le N+1. Survolez une barre pour le détail ; le détail chiffré est dans l'export Excel.</p>
        <div className="space-y-2">
          {distrib.map(({ k, n, tot }) => (
            <div key={k.id} className="grid items-center gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_3rem]">
              <div className="truncate text-xs" title={k.libelle}>{k.libelle}</div>
              <BarreEmpilee
                total={tot}
                hauteur={12}
                segments={[
                  { ...NIVEAUX[0], valeur: n[2] },
                  { ...NIVEAUX[1], valeur: n[3] },
                  { ...NIVEAUX[2], valeur: n[4] },
                  { ...NIVEAUX[3], valeur: n[1] },
                ]}
              />
              <div className="text-right text-xs text-gray-500" title="Part « exigences satisfaites »">{tot ? `${Math.round((n[4] / tot) * 100)} %` : "–"}</div>
            </div>
          ))}
        </div>
      </section>
    </Coquille>
  );
}
