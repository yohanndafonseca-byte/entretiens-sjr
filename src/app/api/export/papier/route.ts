import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { utilisateurCourant } from "@/lib/auth";
import { chargerDossier } from "@/lib/dossier";
import { pdfDuDossier } from "@/lib/workflow";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Un seul PDF regroupant plusieurs comptes rendus, pour impression en une fois. */
export async function GET(req: Request) {
  const u = await utilisateurCourant();
  if (!u?.isAdmin) return new NextResponse("Accès réservé aux RH", { status: 403 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map(Number).filter(Boolean).slice(0, 200);
  if (!ids.length) return new NextResponse("Aucun dossier sélectionné.", { status: 400 });
  const fusion = await PDFDocument.create();
  for (const id of ids) {
    const d = await chargerDossier(id);
    if (!d) continue;
    const src = await PDFDocument.load(await pdfDuDossier(d));
    const pages = await fusion.copyPages(src, src.getPageIndices());
    pages.forEach((p) => fusion.addPage(p));
    // page blanche si nombre impair : chaque CR commence sur un recto en impression recto-verso
    if (src.getPageCount() % 2 === 1) fusion.addPage([pages[0].getWidth(), pages[0].getHeight()]);
  }
  const buf = await fusion.save();
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="CR a imprimer (${ids.length}).pdf"`, "Cache-Control": "private, no-store" },
  });
}
