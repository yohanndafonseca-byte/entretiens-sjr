import Link from "next/link";
import type { Agent } from "@/db/schema";
import { deconnexion } from "@/app/auth-actions";

const LIENS_ADMIN = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/dossiers", label: "Tous les dossiers" },
  { href: "/admin/agents", label: "Agents & circuits" },
  { href: "/admin/import", label: "Imports" },
  { href: "/admin/campagnes", label: "Campagnes" },
  { href: "/admin/exports", label: "Exports" },
  { href: "/admin/emails", label: "E-mails" },
];

export function Entete({ u }: { u: Agent }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="h-1 bg-gradient-to-r from-sjr-vert via-sjr-vert to-sjr-jaune" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sjr.png" alt="" className="h-10 w-10" />
          <div className="leading-tight">
            <div className="text-sm font-bold">Entretiens professionnels</div>
            <div className="text-xs text-gray-500">Ville de Saint-Jean-de-la-Ruelle</div>
          </div>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 font-medium hover:bg-sjr-vert-clair">Mes dossiers</Link>
          {u.isAdmin && (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md px-3 py-1.5 font-medium hover:bg-sjr-vert-clair">Espace RH ▾</summary>
              <div className="absolute z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                {LIENS_ADMIN.map((l) => (
                  <Link key={l.href} href={l.href} className="block rounded-md px-3 py-2 hover:bg-sjr-vert-clair">{l.label}</Link>
                ))}
              </div>
            </details>
          )}
          <Link href="/aide" className="rounded-md px-3 py-1.5 font-medium hover:bg-sjr-vert-clair">Aide</Link>
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
