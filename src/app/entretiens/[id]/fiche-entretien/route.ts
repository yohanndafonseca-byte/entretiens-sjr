import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { calculerDroits, chargerDossier } from "@/lib/dossier";
import { genererFicheVierge } from "@/lib/pdf";

export const runtime = "nodejs";

/** Exemplaire vierge de la fiche d'entretien (avec les objectifs de l'an dernier), à remettre avec la convocation. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new NextResponse("Non connecté", { status: 401 });
  const d = await chargerDossier(Number((await params).id));
  if (!d || !calculerDroits(u, d).voir) return new NextResponse("Introuvable", { status: 404 });
  const pdf = await genererFicheVierge(d);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Fiche entretien.pdf"', "Cache-Control": "private, no-store" } });
}
