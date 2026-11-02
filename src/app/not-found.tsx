import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-gray-600">Ce dossier n'existe pas ou vous n'y avez pas accès.</p>
      <Link href="/" className="btn-primaire">Retour à mes dossiers</Link>
    </main>
  );
}
