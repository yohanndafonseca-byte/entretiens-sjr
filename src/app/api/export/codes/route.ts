import { NextResponse } from "next/server";
import { utilisateurCourant } from "@/lib/auth";
import { agentsSansOutil } from "@/lib/acces";
import { genererFichesCodes } from "@/lib/pdf";

export const runtime = "nodejs";

/** PDF des fiches de code à découper (agents sans outil informatique dont le code n'a pas encore été remplacé). */
export async function GET(req: Request) {
  const u = await utilisateurCourant();
  if (!u?.isAdmin) return new NextResponse("Accès réservé aux RH", { status: 403 });
  const direction = new URL(req.url).searchParams.get("direction");
  const liste = (await agentsSansOutil())
    .filter((a) => a.codeProvisoire && (!direction || a.niv3 === direction))
    .sort((a, b) => (a.niv3 ?? "").localeCompare(b.niv3 ?? "") || (a.niv4 ?? "").localeCompare(b.niv4 ?? "") || a.nom.localeCompare(b.nom));
  if (!liste.length) return new NextResponse("Aucune fiche à imprimer.", { status: 404 });
  const pdf = await genererFichesCodes(liste);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Fiches codes.pdf"', "Cache-Control": "private, no-store" } });
}
