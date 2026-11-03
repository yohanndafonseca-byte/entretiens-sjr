import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { calculerDroits, chargerDossier } from "@/lib/dossier";
import { genererConvocation } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new NextResponse("Non connecté", { status: 401 });
  const d = await chargerDossier(Number((await params).id));
  if (!d || !calculerDroits(u, d).voir || !d.entretien.convocationLe) return new NextResponse("Introuvable", { status: 404 });
  const pdf = await genererConvocation(d, d.entretien.convocationLe, d.entretien.convocationLieu ?? "");
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Convocation.pdf"', "Cache-Control": "private, no-store" } });
}
