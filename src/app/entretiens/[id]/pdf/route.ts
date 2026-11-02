import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { calculerDroits, chargerDossier } from "@/lib/dossier";
import { nomFichierPdf } from "@/lib/pdf";
import { pdfDuDossier } from "@/lib/workflow";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return NextResponse.redirect(new URL("/connexion", process.env.APP_URL ?? "http://localhost:3000"));
  const d = await chargerDossier(Number((await params).id));
  if (!d || !calculerDroits(u, d).voir) return new NextResponse("Introuvable", { status: 404 });
  if (u.id === d.agent.id && d.entretien.statut === "redaction" && !u.isAdmin) return new NextResponse("Non disponible", { status: 403 });
  const pdf = await pdfDuDossier(d);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nomFichierPdf(d))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
