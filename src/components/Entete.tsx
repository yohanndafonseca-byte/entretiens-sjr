import Link from "next/link";
import type { Agent } from "@/db/schema";
import { deconnexion } from "@/app/auth-actions";

const LIENS_ADMIN = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/dossiers", label: "Tous les dossiers" },
  { href: "/admin/papier", label: "Visas papier" },
  { href: "/admin/exports", label: "Exports (PDF, Excel)" },
  { separateur: true },
  { href: "/admin/campagnes", label: "Campagnes" },
  { href: "/admin/import", label: "Agents et dossiers (import)" },
  { href: "/admin/agents", label: "Agents & circuits" },
  { href: "/admin/acces", label: "Accès et codes des agents" },
  { href: "/admin/remplacer", label: "Remplacer une personne" },
  { href: "/admin/emails", label: "E-mails envoyés" },
] as const;

export function Entete({ u }: { u: Agent }) {
  return (
    <header className="border-b border-sjr-ligne bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sjr-primaire text-sm font-black text-white">SJR</span>
          <div className="leading-tight">
            <div className="text-sm font-bold">Entretiens professionnels</div>
            <div className="text-xs text-gray-500">Ville de Saint-Jean-de-la-Ruelle</div>
          </div>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 font-medium hover:bg-sjr-primaire-doux">Mes dossiers</Link>
          <Link href="/visas" className="rounded-md px-3 py-1.5 font-medium hover:bg-sjr-primaire-doux">Mes visas</Link>
          {u.isAdmin && (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md px-3 py-1.5 font-medium hover:bg-sjr-primaire-doux">Espace RH ▾</summary>
              <div className="absolute z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                {LIENS_ADMIN.map((l, i) =>
                  "separateur" in l ? <hr key={i} className="my-1 border-sjr-ligne" /> : (
                  <Link key={l.href} href={l.href} className="block rounded-md px-3 py-2 hover:bg-sjr-primaire-doux hover:text-sjr-primaire-fonce">{l.label}</Link>
                  ),
                )}
              </div>
            </details>
          )}
          <Link href="/aide" className="rounded-md px-3 py-1.5 font-medium hover:bg-sjr-primaire-doux">Aide</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/mot-de-passe" className="text-gray-600 hover:underline" title="Changer mon mot de passe">
            {u.prenom} {u.nom}
          </Link>
          <form action={deconnexion}>
            <button className="btn-secondaire py-1.5">Déconnexion</button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function Coquille({ u, children }: { u: Agent; children: React.ReactNode }) {
  return (
    <>
      <Entete u={u} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
