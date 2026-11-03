import "server-only";
import nodemailer from "nodemailer";
import { db, schema } from "@/db";

type Message = {
  to: string | null | undefined;
  sujet: string;
  corps: string;
  type: "tour" | "relance" | "final" | "convocation" | "autre";
  entretienId?: number;
  pieceJointe?: { nom: string; contenu: Buffer; type?: string };
  piecesJointes?: { nom: string; contenu: Buffer; type?: string }[];
};

let transport: nodemailer.Transporter | null | undefined;
function transporteur() {
  if (transport !== undefined) return transport;
  if (!process.env.SMTP_HOST) return (transport = null);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

export const urlApp = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Envoie (ou journalise si le SMTP n'est pas configuré) un e-mail. Ne lève jamais d'erreur. */
export async function envoyerEmail(m: Message): Promise<boolean> {
  if (!m.to) return false;
  const pj = [...(m.pieceJointe ? [m.pieceJointe] : []), ...(m.piecesJointes ?? [])];
  const t = transporteur();
  let statut = "journalise";
  let erreur: string | null = null;
  if (t) {
    try {
      await t.sendMail({
        from: process.env.SMTP_FROM,
        to: m.to,
        subject: m.sujet,
        text: m.corps,
        attachments: pj.length ? pj.map((x) => ({ filename: x.nom, content: x.contenu, contentType: x.type })) : undefined,
      });
      statut = "envoye";
    } catch (e) {
      statut = "erreur";
      erreur = e instanceof Error ? e.message : String(e);
    }
  }
  await db.insert(schema.emails).values({
    destinataire: m.to,
    sujet: m.sujet,
    corps: m.corps + (pj.length ? `\n\n[Pièce(s) jointe(s) : ${pj.map((x) => x.nom).join(", ")}]` : ""),
    type: m.type,
    entretienId: m.entretienId,
    statut,
    erreur,
  });
  return statut === "envoye";
}
