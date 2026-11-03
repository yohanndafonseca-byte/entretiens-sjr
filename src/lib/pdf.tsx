import "server-only";
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import { LOGO_DATA_URI } from "./logo";
import { contenuVide, ECHELLE, RUBRIQUES } from "./formulaire";
import type { Dossier } from "./dossier";
import { nomComplet } from "./dossier";

// Pas de césure automatique des mots
Font.registerHyphenationCallback((mot) => [mot]);

const GRIS = "#d9d9d9";
const BORD = "#a6a6a6";
const OR = "#e8a317";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: "#222" },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  logo: { width: 80, height: 80, marginRight: 24 },
  enteteTxt: { flex: 1, alignItems: "center" },
  ville: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  titre: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center" },
  boite: { borderWidth: 0.8, borderColor: BORD, padding: 8, marginBottom: 12 },
  ligne: { flexDirection: "row", marginBottom: 5 },
  lbl: { width: 150, fontSize: 8.5 },
  val: { flex: 1, fontSize: 8.5 },
  h1: { fontSize: 11, fontFamily: "Helvetica-Bold", textDecoration: "underline", marginTop: 6, marginBottom: 8 },
  h2: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
  h3: { fontSize: 9, marginTop: 4, marginBottom: 3 },
  p: { fontSize: 8.5, marginBottom: 4, lineHeight: 1.35 },
  petit: { fontSize: 7.5, lineHeight: 1.35, marginBottom: 2 },
  table: { borderWidth: 0.8, borderColor: BORD, marginBottom: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: BORD },
  trLast: { flexDirection: "row" },
  th: { backgroundColor: GRIS, fontFamily: "Helvetica-Bold", fontSize: 8, padding: 4, borderRightWidth: 0.5, borderColor: BORD },
  td: { fontSize: 8, padding: 4, borderRightWidth: 0.5, borderColor: BORD, lineHeight: 1.3 },
  cadreTexte: { borderWidth: 0.8, borderColor: BORD, padding: 6, minHeight: 40, marginBottom: 8, fontSize: 8.5, lineHeight: 1.35 },
  pied: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 7, color: "#777", flexDirection: "row", justifyContent: "space-between" },
});

function Pastilles({ note }: { note: number | null }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center" }}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            marginHorizontal: 1,
            backgroundColor: note && i <= note ? OR : "#cfcfcf",
          }}
        />
      ))}
    </View>
  );
}

type Col = { titre: string; w: number | string };
function Tableau({ cols, lignes, vide = 1 }: { cols: Col[]; lignes: (string | React.ReactNode)[][]; vide?: number }) {
  const rows = lignes.length ? lignes : Array.from({ length: vide }, () => cols.map(() => ""));
  return (
    <View style={s.table} wrap={rows.length > 3}>
      {cols.some((c) => c.titre) && <View style={s.tr}>
        {cols.map((c, i) => (
          <Text key={i} style={[s.th, { width: c.w as number }, i === cols.length - 1 ? { borderRightWidth: 0 } : {}]}>
            {c.titre}
          </Text>
        ))}
      </View>}
      {rows.map((r, ri) => (
        <View key={ri} style={ri === rows.length - 1 ? s.trLast : s.tr} wrap={false}>
          {r.map((cell, ci) => (
            <View key={ci} style={[s.td, { width: cols[ci].w as number, minHeight: 18 }, ci === r.length - 1 ? { borderRightWidth: 0 } : {}]}>
              {typeof cell === "string" ? <Text>{cell}</Text> : cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const fr = (d: Date | number | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "");
const frIso = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "");

function CompteRendu({ d }: { d: NonNullable<Dossier> }) {
  const c = d.contenu;
  const snap = d.snapshot;
  const a = d.agent;
  const services = [snap.niv3, snap.niv4, snap.niv5, snap.niv6].filter(Boolean) as string[];
  const etapesVisees = d.etapes.filter((x) => x.viseLe);

  return (
    <Document title={`CR entretien professionnel ${d.campagne.annee} - ${nomComplet(a)}`} author="Ville de Saint Jean de la Ruelle">
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_DATA_URI} style={s.logo} />
          <View style={s.enteteTxt}>
            <Text style={s.ville}>Ville de Saint Jean de la Ruelle</Text>
            <Text style={s.titre}>COMPTE-RENDU</Text>
            <Text style={s.titre}>DE L’ENTRETIEN PROFESSIONNEL</Text>
            <Text style={s.titre}>ANNUEL {d.campagne.annee}</Text>
          </View>
        </View>

        <View style={s.boite}>
          <View style={s.ligne}>
            <Text style={s.lbl}>AGENT</Text>
            <Text style={s.val}>{`${a.nom} ${a.prenom}`.toUpperCase()}</Text>
          </View>
          {services.map((sv, i) => (
            <View key={i} style={s.ligne}>
              <Text style={s.lbl}></Text>
              <Text style={s.val}>{sv}</Text>
            </View>
          ))}
          <View style={s.ligne}>
            <Text style={s.lbl}>GRADE</Text>
            <Text style={s.val}>{snap.grade ?? ""}</Text>
          </View>
          <View style={s.ligne}>
            <Text style={s.lbl}>INTITULÉ DU POSTE</Text>
            <Text style={s.val}>{snap.poste ?? ""}</Text>
          </View>
        </View>
        <View style={s.boite}>
          <View style={s.ligne}>
            <Text style={s.lbl}>Statut</Text>
            <Text style={s.val}>: {snap.statut ?? ""}</Text>
          </View>
          <View style={s.ligne}>
            <Text style={s.lbl}>Temps de travail</Text>
            <Text style={s.val}>: {snap.tempsTravail ?? ""}</Text>
          </View>
        </View>
        <View style={s.boite}>
          <View style={s.ligne}>
            <Text style={s.lbl}>Responsable hiérarchique direct/e</Text>
            <Text style={s.val}>: {d.redacteur ? `${d.redacteur.nom} ${d.redacteur.prenom}`.toUpperCase() : ""}</Text>
          </View>
          <View style={s.ligne}>
            <Text style={s.lbl}>Fonction</Text>
            <Text style={s.val}>: {c.fonctionRedacteur}</Text>
          </View>
          <View style={s.ligne}>
            <Text style={s.lbl}>Entretien professionnel réalisé le</Text>
            <Text style={s.val}>: {frIso(d.entretien.dateEntretien)}</Text>
          </View>
        </View>

        <View break>
          <Text style={s.h1}>I - APPRECIATION DE L’ATTEINTE DES OBJECTIFS FIXES</Text>
          <Text style={s.p}>La mesure du niveau d’atteinte de l’objectif repose sur l’étude des écarts éventuels entre l’objectif visé et le résultat obtenu.</Text>
          <Tableau
            cols={[
              { titre: "Rappel des objectifs (cf. entretien de l’année précédente)", w: "38%" },
              { titre: "Ajouté en cours d'année", w: "14%" },
              { titre: "Résultat obtenu", w: "18%" },
              { titre: "Analyse des écarts", w: "30%" },
            ]}
            lignes={c.objectifsPrecedents
              .filter((o) => o.objectif.trim())
              .map((o) => [o.objectif, o.ajouteEnCours ? "Oui" : "", o.resultat, o.analyse])}
          />
          <Text style={s.h2}>Expression libre de l’agent :</Text>
          <Text style={s.cadreTexte}>{c.expressionLibre}</Text>
        </View>

        <View break>
          <Text style={s.h1}>II - CARRIERE</Text>
          <Text style={s.p}>Agent réunissant les conditions statutaires pour prétendre à :</Text>
          <Tableau
            cols={[
              { titre: "", w: "35%" },
              { titre: "", w: "65%" },
            ]}
            lignes={[
              [`Un avancement d’échelon ${c.carriere.echelon ? "(oui)" : ""}`,`Date d’effet : ${frIso(c.carriere.echelonDateEffet)}`],
              [`Un avancement de grade ${c.carriere.grade ? "(oui)" : ""}`, `Date de réussite à l’examen professionnel : ${frIso(c.carriere.gradeDateExamen)}`],
              [
                `Une promotion interne ${c.carriere.promotion ? "(oui)" : ""}`,
                `Date de réussite à l’examen professionnel : ${frIso(c.carriere.promotionDateExamen1)}\nDate de réussite à l’examen professionnel : ${frIso(c.carriere.promotionDateExamen2)}`,
              ],
            ]}
          />
          <Text style={s.p}>Avis du supérieur hiérarchique sur les propositions :</Text>
          <Tableau cols={[{ titre: "D’avancement sur le grade :", w: "40%" }, { titre: "", w: "60%" }]} lignes={[["", c.carriere.avisAvancementGrade]]} />
          <Tableau cols={[{ titre: "De promotion interne sur le grade :", w: "40%" }, { titre: "", w: "60%" }]} lignes={[["", c.carriere.avisPromotion1]]} />
          <Tableau cols={[{ titre: "De promotion interne sur le grade :", w: "40%" }, { titre: "", w: "60%" }]} lignes={[["", c.carriere.avisPromotion2]]} />
        </View>

        <View break>
          <Text style={s.h1}>III - APPRÉCIATION DE LA MANIÈRE DE SERVIR, DES COMPÉTENCES ET DES ACQUIS DE L’EXPÉRIENCE</Text>
          <View style={[s.boite, { flexDirection: "row", alignItems: "center" }]}>
            <Text style={{ width: 120, fontSize: 8.5, textAlign: "center" }}>Légende</Text>
            <View>
              {ECHELLE.map((e) => (
                <View key={e.valeur} style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Pastilles note={e.valeur} />
                  <Text style={{ marginLeft: 8, fontSize: 8 }}>{e.libelle}</Text>
                </View>
              ))}
            </View>
          </View>
          {RUBRIQUES.map((r) => (
            <View key={r.titre}>
              <Text style={s.h2}>{r.titre.toUpperCase()}</Text>
              {r.groupes.map((g, gi) => (
                <View key={gi} wrap={false}>
                  {g.titre ? <Text style={s.h3}>{g.titre}</Text> : null}
                  <Tableau
                    cols={[
                      { titre: "Critères", w: "50%" },
                      { titre: "Appréciation", w: "18%" },
                      { titre: "Remarques", w: "32%" },
                    ]}
                    lignes={g.criteres.map((k) => [
                      k.libelle,
                      <Pastilles key={k.id} note={c.criteres[k.id]?.note ?? null} />,
                      c.criteres[k.id]?.remarque ?? "",
                    ])}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>

        <View break>
          <Text style={s.h1}>IV - DEFINITION DES OBJECTIFS</Text>
          <Text style={s.h2}>Objectifs généraux :</Text>
          <Tableau
            cols={[
              { titre: "Objectifs généraux Ville de Saint Jean de la Ruelle", w: "50%" },
              { titre: "Objectifs de la direction et du pôle", w: "50%" },
            ]}
            lignes={[[d.objectifsVille, d.objectifsDirection.map((o) => o.texte).join("\n\n")]]}
          />
          <Text style={s.h2}>Objectifs individuels de l’agent :</Text>
          <Tableau
            cols={[
              { titre: "Objectifs", w: "35%" },
              { titre: "Moyens", w: "47%" },
              { titre: "Echéance", w: "18%" },
            ]}
            lignes={c.objectifs.filter((o) => o.objectif.trim()).map((o) => [o.objectif, o.moyens, frIso(o.echeance)])}
          />
        </View>

        <View break>
          <Text style={s.h1}>V - FORMATION</Text>
          <Text style={s.h2}>ACTIONS SUIVIES DURANT L’ANNÉE :</Text>
          <Tableau
            cols={[
              { titre: "Intitulé de la formation", w: "25%" },
              { titre: "Rappel des motivations : objectifs", w: "25%" },
              { titre: "Evaluation à froid", w: "20%" },
              { titre: "Commentaires Réinvestissement des acquis", w: "30%" },
            ]}
            lignes={c.formationsSuivies.filter((f) => f.intitule.trim()).map((f) => [f.intitule, f.motivations, f.evaluation, f.commentaires])}
          />
          <Text style={s.h2}>Remarques sur les formations suivies :</Text>
          <Text style={s.cadreTexte}>{c.remarquesFormations}</Text>
          <Text style={s.h2}>BESOINS DE FORMATION</Text>
          <Tableau
            cols={[
              { titre: "À l’initiative de", w: "15%" },
              { titre: "Intitulé de la formation (catalogue)", w: "25%" },
              { titre: "Intitulé du besoin (expression libre) et objectif", w: "35%" },
              { titre: "Avis du/de la responsable hiérarchique direct/e", w: "25%" },
            ]}
            lignes={c.besoinsFormation.filter((b) => b.catalogue.trim() || b.besoin.trim()).map((b) => [b.initiative, b.catalogue, b.besoin, b.avis])}
          />
          <Text style={s.petit}>
            Tous les agents titulaires sont tenus à une obligation de formation de professionnalisation tout au long de la carrière, de 2 à 10 jours par période de 5 ans.
          </Text>
          <Text style={s.petit}>
            Attention : le non-respect de cette obligation empêchera l’agent de pouvoir être inscrit sur une liste d’aptitude au titre de la promotion interne. Aussi, il appartient à chacun de s’assurer qu’il bénéficie bien d’un minimum de 2 jours de formation tous les 5 ans.
          </Text>
          <Text style={s.petit}>
            Les formations obligatoires évoquées ci-dessus ne concernent pas les agents de la filière Police qui ont leurs propres obligations, notamment en termes de formation continue obligatoire.
          </Text>
          <Text style={[s.petit, { marginTop: 4 }]}>NB :</Text>
          <Text style={s.petit}>Toute demande de l’agent doit être relevée dans ce tableau,</Text>
          <Text style={s.petit}>L’avis du/de la responsable et le niveau de priorité sont requis pour toutes les demandes liées au poste occupé ;</Text>
          <Text style={s.petit}>
            Dans le cas contraire, le préciser (formations relevant de la formation professionnelle ou du DIF – Droit individuel à la Formation professionnelle).
          </Text>
        </View>

        <View break>
          <Text style={s.h1}>VI - VŒUX DE L’AGENT</Text>
          <Tableau
            cols={[
              { titre: "CARRIÈRE, GRADE, STATUT", w: "60%" },
              { titre: "Avis du/de la responsable hiérarchique direct/e", w: "40%" },
            ]}
            lignes={[[c.voeux.carriere.texte, c.voeux.carriere.avis]]}
          />
          <Tableau
            cols={[
              { titre: "ÉVOLUTION DE FONCTION MOBILITÉ INTERNE/EXTERNE — L’agent souhaite :", w: "45%" },
              { titre: "", w: "10%" },
              { titre: "Avis du/de la responsable hiérarchique direct/e", w: "25%" },
              { titre: "Précision de l’agent", w: "20%" },
            ]}
            lignes={(
              [
                ["Une évolution de ses fonctions sur le poste actuel", c.voeux.evolutionPoste],
                ["Un changement de poste au sein de la collectivité", c.voeux.changementInterne],
                ["Un changement de poste en dehors de la collectivité", c.voeux.changementExterne],
              ] as const
            ).map(([l, v]) => [l, v.souhait, v.avis, v.precision])}
          />
          {(
            [
              ["ENVIRONNEMENT DU POSTE (Besoins matériel, hygiène et sécurité au travail…)", c.voeux.environnement],
              ["ORGANISATION DU TRAVAIL", c.voeux.organisation],
              ["AUTRES VŒUX", c.voeux.autres],
            ] as const
          ).map(([t, v]) => (
            <Tableau
              key={t}
              cols={[
                { titre: t, w: "60%" },
                { titre: "Avis du/de la responsable hiérarchique direct/e", w: "40%" },
              ]}
              lignes={[[v.texte, v.avis]]}
            />
          ))}
          <View wrap={false}>
            <Text style={[s.th, { borderWidth: 0.8, textAlign: "center" }]}>
              APPRÉCIATION GÉNÉRALE DE LA VALEUR PROFESSIONNELLE DE L’AGENT PAR LE/LA RESPONSABLE HIÉRARCHIQUE DIRECT/E
            </Text>
            <Text style={[s.cadreTexte, { borderTopWidth: 0, minHeight: 80 }]}>{c.appreciationGenerale}</Text>
          </View>

          <View style={s.table} wrap={false}>
            <Text style={[s.th, { borderRightWidth: 0 }]}>
              VISA DU RESPONSABLE HIERARCHIQUE ({d.redacteur ? `${d.redacteur.nom} ${d.redacteur.prenom}`.toUpperCase() : ""})
            </Text>
            <Text style={s.td}>Visé le : {fr(d.entretien.visaRedacteurLe)}</Text>
          </View>

          <View style={s.table}>
            {d.etapes.map((x, i) => (
              <View key={x.id} style={i === d.etapes.length - 1 ? s.trLast : s.tr} wrap={false}>
                <Text style={[s.th, { width: "35%" }]}>VISA DE {`${x.acteur.nom} ${x.acteur.prenom}`.toUpperCase()}</Text>
                <View style={[s.td, { width: "65%", borderRightWidth: 0 }]}>
                  <Text>Observations éventuelles : {x.observations ?? ""}</Text>
                  <Text style={{ marginTop: 4 }}>
                    Visé le : {fr(x.viseLe)}
                    {x.modeVisa === "papier" ? " (visa recueilli sur papier)" : x.modeVisa === "en_presence" ? " (visa en présence du responsable)" : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {etapesVisees.length < d.etapes.length ? (
            <Text style={[s.petit, { color: "#b00" }]}>Document provisoire : circuit de visas non terminé.</Text>
          ) : null}
        </View>

        <View break>
          <Text style={s.h1}>VII - VOIES DE RECOURS</Text>
          <Text style={s.h2}>1 - Procédure de révision</Text>
          <Text style={s.h3}>Révision auprès de l'autorité territoriale</Text>
          <Text style={s.p}>
            Le fonctionnaire peut demander la révision du compte rendu de l'entretien professionnel à son autorité territoriale dans un délai de 15 jours francs suivant la notification de ce compte-rendu d'entretien. L'autorité territoriale notifie ensuite sa réponse dans un délai de 15 jours après la demande de révision de l'entretien professionnel. L'absence de réponse dans le délai fixé est considérée comme un rejet de la demande de révision.
          </Text>
          <Text style={s.h3}>Révision auprès de la Commission Administrative Paritaire</Text>
          <Text style={s.p}>
            La commission administrative paritaire peut, à la demande de l'intéressé et sous réserve qu'il ait au préalable exercé la demande de révision décrite ci-dessus, proposer à l'autorité territoriale la modification du compte rendu de l'entretien professionnel. Dans ce cas, communication doit être faite aux commissions de tous éléments utiles d’information. La demande doit lui parvenir dans un délai d'1 mois suivant la notification – explicite ou implicite - de la réponse formulée par l'autorité territoriale dans le cadre de la demande de révision.
          </Text>
          <Text style={s.h2}>2 - Recours de droit commun</Text>
          <Text style={s.h3}>2-1 Le recours gracieux :</Text>
          <Text style={s.p}>Il doit être adressé à l'autorité territoriale dans un délai de 2 mois à compter soit :</Text>
          <Text style={s.p}>- De la notification initiale du compte rendu de l'entretien professionnel ;</Text>
          <Text style={s.p}>- De la réception de la réponse de l'autorité territoriale à la demande de révision (explicite ou implicite) ;</Text>
          <Text style={s.p}>- Après communication du compte rendu d'entretien éventuellement révisé par l'autorité territoriale, sur proposition de la C.A.P. compétente.</Text>
          <Text style={s.p}>
            L'absence de réponse, notamment dans les deux derniers cas précités, vaut décision implicite de rejet au terme de 2 mois suivant le recours de l'agent.
          </Text>
          <Text style={s.h3}>2-2 Le recours contentieux :</Text>
          <Text style={s.p}>Le recours contentieux s'exerce dans les mêmes conditions que le recours gracieux à savoir 2 mois à compter soit :</Text>
          <Text style={s.p}>- De la notification initiale du compte rendu de l'entretien professionnel,</Text>
          <Text style={s.p}>- De la réception de la réponse de l'autorité territoriale à la demande de révision (explicite ou implicite),</Text>
          <Text style={s.p}>- Après communication de son compte rendu d'entretien par l'autorité territoriale, sur proposition de la C.A.P. compétente,</Text>
          <Text style={s.p}>- De la réponse (ou de la décision implicite de rejet) au recours gracieux, le cas échéant.</Text>
          <Text style={s.p}>
            Le compte rendu de l'entretien professionnel peut être contesté directement devant le juge sans que le défaut de demande préalable de révision auprès de la C.A.P. et l'absence de recours gracieux y fassent obstacle.
          </Text>
          <Text style={s.p}>
            Le présent compte rendu peut donc faire l'objet d'un recours contentieux devant le tribunal administratif compétent dans un délai de 2 mois à compter de sa notification.
          </Text>
        </View>

        <View style={s.pied} fixed>
          <Text>
            CR entretien professionnel {d.campagne.annee} — {`${a.nom} ${a.prenom}`} — matricule {a.matricule}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function genererPdf(d: NonNullable<Dossier>): Promise<Buffer> {
  return renderToBuffer(<CompteRendu d={d} />);
}

const nettoyer = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 \-_.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Ex. « DUPONT Marie - EP 2026 - entretien du 11-12-2026.pdf » */
export function nomFichierPdf(d: NonNullable<Dossier>) {
  const date = d.entretien.dateEntretien ? ` - entretien du ${d.entretien.dateEntretien.split("-").reverse().join("-")}` : "";
  return `${nettoyer(d.agent.nom.toUpperCase())} ${nettoyer(d.agent.prenom)} - EP ${d.campagne.annee}${date}.pdf`;
}

/** Chemin dans l'archive zip, calqué sur le serveur : Ville|CCAS / Statut / fichier.pdf */
export function cheminServeur(d: NonNullable<Dossier>) {
  const coll = nettoyer(d.snapshot.collectivite ?? d.agent.collectivite ?? "Ville") || "Ville";
  const statut = nettoyer((d.snapshot.statut ?? d.agent.statut ?? "Autre").toLowerCase()).replace(/^./, (m) => m.toUpperCase()) || "Autre";
  return `${coll}/${statut}/${nomFichierPdf(d)}`;
}

/* ------------------------------------------------------------------ */
/* Convocation à l'entretien (décret n° 2014-1526, art. 3)             */
/* ------------------------------------------------------------------ */

export function formatDateHeure(local: string) {
  const [d, h] = local.split("T");
  const date = new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return { date, heure: (h ?? "").slice(0, 5).replace(":", " h ") };
}

function Convocation({ d, quand, lieu, codeAgent }: { d: NonNullable<Dossier>; quand: string; lieu: string; codeAgent: string | null }) {
  const { date, heure } = formatDateHeure(quand);
  const a = d.agent;
  const r = d.redacteur;
  const p = { fontSize: 10.5, lineHeight: 1.55, marginBottom: 10 };
  return (
    <Document title={`Convocation entretien professionnel ${d.campagne.annee} - ${nomComplet(a)}`}>
      <Page size="A4" style={[s.page, { paddingHorizontal: 60, paddingTop: 50 }]}>
        <View style={s.entete}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_DATA_URI} style={{ width: 70, height: 70, marginRight: 20 }} />
          <View>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>Ville de Saint Jean de la Ruelle</Text>
            <Text style={{ fontSize: 9, color: "#555", marginTop: 3 }}>{[d.snapshot.niv3, d.snapshot.niv4].filter(Boolean).join(" – ")}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 10.5, textAlign: "right", marginBottom: 30 }}>Le {new Date().toLocaleDateString("fr-FR")}</Text>
        <Text style={{ fontSize: 10.5, marginBottom: 2 }}>À l'attention de</Text>
        <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 30 }}>{`${a.prenom} ${a.nom.toUpperCase()}`}</Text>
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 20 }}>
          Objet : convocation à l'entretien professionnel annuel {d.campagne.annee}
        </Text>
        <Text style={p}>Madame, Monsieur,</Text>
        <Text style={p}>
          Je vous informe que votre entretien professionnel annuel aura lieu le <Text style={{ fontFamily: "Helvetica-Bold" }}>{date} à {heure}</Text>
          {lieu ? <Text>, {lieu}</Text> : null}.
        </Text>
        <Text style={p}>
          Cet entretien, conduit par votre supérieur(e) hiérarchique direct(e), portera notamment sur vos résultats professionnels au regard des objectifs qui vous ont été assignés, vos objectifs pour l'année à venir, votre manière de servir, vos acquis de l'expérience professionnelle, vos besoins de formation et vos perspectives d'évolution professionnelle.
        </Text>
        <Text style={p}>
          Vous trouverez ci-joint votre fiche de poste{d.entretien.fichePosteNom ? "" : " (si elle vous a été transmise)"} ainsi qu'un exemplaire de la fiche d'entretien, afin de vous permettre de préparer cet échange.
        </Text>
        {codeAgent ? (
          <View style={{ borderWidth: 0.8, borderColor: "#999", padding: 10, marginBottom: 14 }}>
            <Text style={{ fontSize: 10 }}>
              Pour viser votre compte rendu après l'entretien : matricule <Text style={{ fontFamily: "Helvetica-Bold" }}>{a.matricule}</Text> – code personnel{" "}
              <Text style={{ fontFamily: "Courier-Bold", fontSize: 12 }}>{codeAgent}</Text>
            </Text>
            <Text style={{ fontSize: 8, color: "#555", marginTop: 3 }}>Ce code est personnel : ne le communiquez à personne.</Text>
          </View>
        ) : null}
        <Text style={[p, { marginBottom: 40 }]}>Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: "45%" }}>
            <Text style={{ fontSize: 9, color: "#555" }}>Remis en main propre le : ____ / ____ / ________</Text>
            <Text style={{ fontSize: 9, color: "#555", marginTop: 14 }}>Signature de l'agent :</Text>
          </View>
          <View style={{ width: "45%" }}>
            <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold" }}>{r ? `${r.prenom} ${r.nom.toUpperCase()}` : ""}</Text>
            <Text style={{ fontSize: 9.5, color: "#555" }}>{d.contenu.fonctionRedacteur}</Text>
          </View>
        </View>
        <Text style={{ position: "absolute", bottom: 30, left: 60, right: 60, fontSize: 7.5, color: "#777" }}>
          Décret n° 2014-1526 du 16 décembre 2014 relatif à l'appréciation de la valeur professionnelle des fonctionnaires territoriaux : la date de l'entretien est fixée par le supérieur hiérarchique direct et communiquée à l'agent au moins huit jours à l'avance, accompagnée de la fiche de poste et d'un exemplaire de la fiche d'entretien.
        </Text>
      </Page>
    </Document>
  );
}

export async function genererConvocation(d: NonNullable<Dossier>, quand: string, lieu: string): Promise<Buffer> {
  // agent sans outil informatique (sans e-mail ou classé comme tel) : son code de campagne figure sur la convocation remise en main propre
  const sansOutil = d.agent.profilAcces === "sans_outil" || (d.agent.profilAcces === "auto" && !d.agent.email);
  return renderToBuffer(<Convocation d={d} quand={quand} lieu={lieu} codeAgent={sansOutil ? d.agent.codeProvisoire : null} />);
}

/** Fiche d'entretien à remettre avec la convocation : le modèle vierge, avec les objectifs de l'an dernier. */
export async function genererFicheVierge(d: NonNullable<Dossier>): Promise<Buffer> {
  const vierge = contenuVide();
  vierge.fonctionRedacteur = d.contenu.fonctionRedacteur;
  vierge.objectifsPrecedents = d.contenu.objectifsPrecedents.filter((o) => !o.ajouteEnCours).map((o) => ({ ...o, resultat: "", analyse: "" }));
  const copie = {
    ...d,
    contenu: vierge,
    etapes: d.etapes.map((x) => ({ ...x, viseLe: null, observations: null, modeVisa: null })),
    entretien: { ...d.entretien, dateEntretien: d.entretien.convocationLe?.slice(0, 10) ?? null, visaRedacteurLe: null },
  };
  return renderToBuffer(<CompteRendu d={copie} />);
}

/* ------------------------------------------------------------------ */
/* Fiches de code personnel à découper (agents sans outil informatique) */
/* ------------------------------------------------------------------ */

type FicheCode = { nom: string; prenom: string; matricule: string; codeProvisoire: string | null; niv3: string | null; niv4: string | null };

function FichesCodes({ agents }: { agents: FicheCode[] }) {
  const adresse = (process.env.APP_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <Document title="Codes personnels – entretiens professionnels">
      <Page size="A4" style={{ padding: 24, fontFamily: "Helvetica", flexDirection: "row", flexWrap: "wrap" }}>
        {agents.map((a) => (
          <View
            key={a.matricule}
            wrap={false}
            style={{ width: "50%", height: 150, padding: 12, borderWidth: 0.6, borderStyle: "dashed", borderColor: "#888" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={LOGO_DATA_URI} style={{ width: 26, height: 26, marginRight: 8 }} />
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>Entretiens professionnels</Text>
            </View>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>{`${a.nom} ${a.prenom}`}</Text>
            <Text style={{ fontSize: 7.5, color: "#666", marginBottom: 6 }}>{a.niv4 ?? a.niv3 ?? ""}</Text>
            {adresse ? <Text style={{ fontSize: 9 }}>Adresse : {adresse}</Text> : null}
            <Text style={{ fontSize: 9 }}>Matricule : {a.matricule}</Text>
            <Text style={{ fontSize: 9 }}>
              Code personnel : <Text style={{ fontFamily: "Courier-Bold", fontSize: 13 }}>{a.codeProvisoire ?? ""}</Text>
            </Text>
            <Text style={{ fontSize: 7, color: "#666", marginTop: 6 }}>
              Ce code vous permet de viser votre compte rendu d'entretien, sur le poste de votre responsable ou sur Internet. Il est personnel : ne le communiquez à personne.
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function genererFichesCodes(agents: FicheCode[]): Promise<Buffer> {
  return renderToBuffer(<FichesCodes agents={agents} />);
}
