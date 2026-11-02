import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { utilisateurCourant } from "@/lib/auth";
import { libelleEtape, lignesListe } from "@/lib/dossier";
import { ECHELLE, normaliserContenu, TOUS_CRITERES } from "@/lib/formulaire";
import { classeurExcel } from "@/lib/tableur";

export const runtime = "nodejs";

const fr = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
const frIso = (s: string | null | undefined) => (s ? s.split("-").reverse().join("/") : "");

export async function GET(req: Request) {
  const u = await utilisateurCourant();
  if (!u?.isAdmin) return new NextResponse("Accès réservé aux RH", { status: 403 });
  const p = new URL(req.url).searchParams;
  const campagneId = Number(p.get("campagne"));
  const type = p.get("type") ?? "suivi";
  const lignes = await lignesListe(undefined, campagneId);
  const ids = lignes.map((l) => l.id);
  const es = ids.length ? await db.select().from(schema.entretiens).where(inArray(schema.entretiens.id, ids)) : [];
  const parId = new Map(es.map((e) => [e.id, e]));
  const [camp] = await db.select().from(schema.campagnes).where(eq(schema.campagnes.id, campagneId));
  const base = (l: (typeof lignes)[number]) => ({
    matricule: l.matricule,
    nom: l.agentNom,
    prenom: l.agentPrenom,
    collectivite: l.collectivite,
    statutAgent: l.statutAgent,
    direction: l.niv3,
    pole: l.niv4,
  });
  const colsBase = [
    { titre: "Matricule", cle: "matricule", largeur: 11 },
    { titre: "Nom", cle: "nom", largeur: 18 },
    { titre: "Prénom", cle: "prenom", largeur: 14 },
    { titre: "Collectivité", cle: "collectivite", largeur: 10 },
    { titre: "Statut", cle: "statutAgent", largeur: 13 },
    { titre: "Direction", cle: "direction", largeur: 30 },
    { titre: "Pôle", cle: "pole", largeur: 25 },
  ];
  let buf: Buffer;
  let nom: string;

  if (type === "formation") {
    const rows: Record<string, unknown>[] = [];
    for (const l of lignes) {
      const c = normaliserContenu(parId.get(l.id)?.contenu);
      for (const b of c.besoinsFormation.filter((x) => x.catalogue.trim() || x.besoin.trim()))
        rows.push({ ...base(l), initiative: b.initiative, catalogue: b.catalogue, besoin: b.besoin, avis: b.avis, etape: libelleEtape(l) });
    }
    buf = await classeurExcel([{ nom: "Besoins de formation", colonnes: [...colsBase, { titre: "À l'initiative de", cle: "initiative", largeur: 12 }, { titre: "Formation (catalogue)", cle: "catalogue", largeur: 35 }, { titre: "Besoin exprimé et objectif", cle: "besoin", largeur: 45 }, { titre: "Avis du responsable", cle: "avis", largeur: 18 }, { titre: "État du CR", cle: "etape", largeur: 18 }], lignes: rows }]);
    nom = `Besoins de formation ${camp.annee}.xlsx`;
  } else if (type === "voeux") {
    const rows = lignes.map((l) => {
      const c = normaliserContenu(parId.get(l.id)?.contenu);
      const v = c.voeux;
      return {
        ...base(l),
        carriere: v.carriere.texte, carriereAvis: v.carriere.avis,
        evol: v.evolutionPoste.souhait, evolAvis: v.evolutionPoste.avis,
        interne: v.changementInterne.souhait, interneAvis: v.changementInterne.avis, internePrec: v.changementInterne.precision,
        externe: v.changementExterne.souhait, externeAvis: v.changementExterne.avis, externePrec: v.changementExterne.precision,
        env: v.environnement.texte, org: v.organisation.texte, autres: v.autres.texte,
        echelon: c.carriere.echelon ? "Oui" : "", grade: c.carriere.grade ? "Oui" : "", promo: c.carriere.promotion ? "Oui" : "",
      };
    });
    buf = await classeurExcel([{ nom: "Vœux et carrière", colonnes: [...colsBase,
      { titre: "Vœu carrière/grade/statut", cle: "carriere", largeur: 30 }, { titre: "Avis", cle: "carriereAvis", largeur: 20 },
      { titre: "Évolution sur le poste", cle: "evol", largeur: 10 }, { titre: "Avis", cle: "evolAvis", largeur: 18 },
      { titre: "Mobilité interne", cle: "interne", largeur: 10 }, { titre: "Avis", cle: "interneAvis", largeur: 18 }, { titre: "Précision", cle: "internePrec", largeur: 20 },
      { titre: "Mobilité externe", cle: "externe", largeur: 10 }, { titre: "Avis", cle: "externeAvis", largeur: 18 }, { titre: "Précision", cle: "externePrec", largeur: 20 },
      { titre: "Environnement du poste", cle: "env", largeur: 30 }, { titre: "Organisation du travail", cle: "org", largeur: 30 }, { titre: "Autres vœux", cle: "autres", largeur: 30 },
      { titre: "Éligible échelon", cle: "echelon", largeur: 9 }, { titre: "Éligible grade", cle: "grade", largeur: 9 }, { titre: "Éligible promo interne", cle: "promo", largeur: 9 },
    ], lignes: rows }]);
    nom = `Voeux et carriere ${camp.annee}.xlsx`;
  } else if (type === "appreciations") {
    const lib = (n: number | null | undefined) => ECHELLE.find((e) => e.valeur === n)?.libelle ?? "";
    const rows = lignes.map((l) => {
      const c = normaliserContenu(parId.get(l.id)?.contenu);
      return { ...base(l), ...Object.fromEntries(TOUS_CRITERES.map((k) => [k.id, lib(c.criteres[k.id]?.note)])), etape: libelleEtape(l) };
    });
    buf = await classeurExcel([{ nom: "Appréciations", colonnes: [...colsBase, ...TOUS_CRITERES.map((k) => ({ titre: k.libelle, cle: k.id, largeur: 16 })), { titre: "État du CR", cle: "etape", largeur: 18 }], lignes: rows }]);
    nom = `Appreciations ${camp.annee}.xlsx`;
  } else {
    const rows = lignes.map((l) => {
      const e = parId.get(l.id);
      return {
        ...base(l),
        redacteur: l.redacteurNom,
        etape: libelleEtape(l),
        attente: l.acteurCourantNom,
        avancement: `${Math.min(l.etapeIndex + 1, l.nbEtapes)} / ${l.nbEtapes}`,
        dateEntretien: frIso(e?.dateEntretien),
        visaN1: fr(e?.visaRedacteurLe),
        termine: fr(e?.termineLe),
        derniere: fr(l.derniereActionLe),
      };
    });
    buf = await classeurExcel([{ nom: "Suivi de campagne", colonnes: [...colsBase,
      { titre: "N+1 (rédacteur)", cle: "redacteur", largeur: 22 }, { titre: "Étape", cle: "etape", largeur: 20 }, { titre: "En attente de", cle: "attente", largeur: 22 },
      { titre: "Avancement", cle: "avancement", largeur: 10 }, { titre: "Date entretien", cle: "dateEntretien", largeur: 12 }, { titre: "Visa N+1", cle: "visaN1", largeur: 12 },
      { titre: "Terminé le", cle: "termine", largeur: 12 }, { titre: "Dernière action", cle: "derniere", largeur: 12 },
    ], lignes: rows }]);
    nom = `Suivi campagne ${camp.annee}.xlsx`;
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
    },
  });
}
