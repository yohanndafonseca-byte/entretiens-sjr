import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { chargerDossier, nomComplet } from "./dossier";
import { envoyerEmail, urlApp } from "./emails";
import { formatDateHeure, genererConvocation, genererFicheVierge } from "./pdf";
import { journaliser } from "./workflow";

export const DELAI_CONVOCATION_JOURS = 8;
export const DELAI_NOTIFICATION_JOURS = 15;

/** Heure de Paris (AAAA-MM-JJTHH:MM) → Date UTC, en tenant compte de l'heure d'été. */
export function parisVersUtc(local: string): Date {
  const [d, h = "09:00"] = local.split("T");
  const [Y, M, D] = d.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  const supposition = Date.UTC(Y, M - 1, D, hh, mm);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(supposition))
      .map((p) => [p.type, p.value]),
  );
  const vuAParis = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(supposition - (vuAParis - supposition));
}

/** Nombre de jours entiers entre aujourd'hui et la date prévue. */
export function joursAvant(local: string) {
  return Math.floor((parisVersUtc(local).getTime() - Date.now()) / 86_400_000);
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsTexte = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function invitationIcs(o: { uid: string; debut: Date; minutes: number; titre: string; lieu: string; description: string; organisateur?: string | null; participants: (string | null | undefined)[] }) {
  const fin = new Date(o.debut.getTime() + o.minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ville de Saint-Jean-de-la-Ruelle//Entretiens professionnels//FR",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${o.uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(o.debut)}`,
    `DTEND:${icsDate(fin)}`,
    `SUMMARY:${icsTexte(o.titre)}`,
    `LOCATION:${icsTexte(o.lieu)}`,
    `DESCRIPTION:${icsTexte(o.description)}`,
    ...(o.organisateur ? [`ORGANIZER:mailto:${o.organisateur}`] : []),
    ...o.participants.filter(Boolean).map((p) => `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${p}`),
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Entretien professionnel demain",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Envoie la convocation (e-mail + invitation agenda + pièces) à l'agent et au N+1. Renvoie si l'agent a pu être prévenu par e-mail. */
export async function envoyerConvocation(entretienId: number, parId: number, motifDelaiCourt: string | null) {
  const d = await chargerDossier(entretienId);
  if (!d || !d.entretien.convocationLe) return { emailAgent: false };
  const quand = d.entretien.convocationLe;
  const lieu = d.entretien.convocationLieu ?? "";
  const { date, heure } = formatDateHeure(quand);
  const lettre = await genererConvocation(d, quand, lieu);
  const fiche = await genererFicheVierge(d);
  const ics = invitationIcs({
    uid: `entretien-${entretienId}@entretiens-sjr`,
    debut: parisVersUtc(quand),
    minutes: 60,
    titre: `Entretien professionnel ${d.campagne.annee} – ${nomComplet(d.agent)}`,
    lieu,
    description: `Entretien professionnel annuel ${d.campagne.annee} conduit par ${nomComplet(d.redacteur)}.`,
    organisateur: d.redacteur?.email,
    participants: [d.agent.email, d.redacteur?.email],
  });
  const pj = [
    { nom: "Convocation.pdf", contenu: lettre, type: "application/pdf" },
    { nom: `Fiche d'entretien ${d.campagne.annee}.pdf`, contenu: fiche, type: "application/pdf" },
    ...(d.entretien.fichePoste ? [{ nom: d.entretien.fichePosteNom ?? "Fiche de poste.pdf", contenu: Buffer.from(d.entretien.fichePoste) }] : []),
    { nom: "invitation.ics", contenu: Buffer.from(ics, "utf8"), type: "text/calendar; method=REQUEST" },
  ];
  await envoyerEmail({
    to: d.agent.email,
    type: "convocation",
    entretienId,
    sujet: `Convocation à votre entretien professionnel ${d.campagne.annee} – ${date} à ${heure}`,
    corps: `Bonjour,\n\nVotre entretien professionnel annuel ${d.campagne.annee} aura lieu le ${date} à ${heure}${lieu ? `, ${lieu}` : ""}, avec ${nomComplet(d.redacteur)}.\n\nVous trouverez ci-joint votre convocation, votre fiche de poste${d.entretien.fichePoste ? "" : " (si elle a été jointe)"} et un exemplaire de la fiche d'entretien pour le préparer. L'invitation peut être ajoutée à votre agenda.\n\nVous pouvez aussi retrouver ces documents sur ${urlApp()}/entretiens/${entretienId}\n\nLe service des Ressources Humaines`,
    piecesJointes: pj,
  });
  if (d.redacteur?.email)
    await envoyerEmail({
      to: d.redacteur.email,
      type: "convocation",
      entretienId,
      sujet: `Entretien de ${nomComplet(d.agent)} planifié le ${date} à ${heure}`,
      corps: `Bonjour,\n\nL'entretien professionnel de ${nomComplet(d.agent)} est planifié le ${date} à ${heure}${lieu ? `, ${lieu}` : ""}.\n${d.agent.email ? "La convocation lui a été envoyée par e-mail." : "L'agent n'a pas d'adresse e-mail : imprimez la convocation depuis le dossier et remettez-la lui en main propre, avec sa fiche de poste et la fiche d'entretien."}\n\nDossier : ${urlApp()}/entretiens/${entretienId}`,
      piecesJointes: [pj[pj.length - 1]],
    });
  const emailAgent = !!d.agent.email;
  await db.update(schema.entretiens).set({ convocationEnvoyeeLe: new Date() }).where(eq(schema.entretiens.id, entretienId));
  await journaliser(
    entretienId,
    parId,
    "Convocation envoyée",
    `Entretien le ${date} à ${heure}${lieu ? `, ${lieu}` : ""}${emailAgent ? "" : " – agent sans e-mail (convocation à remettre en main propre)"}${motifDelaiCourt ? ` – délai inférieur à ${DELAI_CONVOCATION_JOURS} jours : ${motifDelaiCourt}` : ""}`,
  );
  return { emailAgent };
}
