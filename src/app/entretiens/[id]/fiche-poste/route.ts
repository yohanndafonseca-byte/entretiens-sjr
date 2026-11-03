import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { calculerDroits, chargerDossier } from "@/lib/dossier";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await utilisateurCourant();
  if (!u) return new NextResponse("Non connecté", { status: 401 });
  const d = await chargerDossier(Number((await params).id));
  if (!d || !calculerDroits(u, d).voir || !d.entretien.fichePoste) return new NextResponse("Introuvable", { status: 404 });
  const nom = d.entretien.fichePosteNom ?? "Fiche de poste.pdf";
  const type = nom.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
  return new NextResponse(new Uint8Array(d.entretien.fichePoste), {
    headers: { "Content-Type": type, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nom)}`, "Cache-Control": "private, no-store" },
  });
}
