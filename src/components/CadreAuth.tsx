export function CadreAuth({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-sjr.png" alt="Ville de Saint-Jean-de-la-Ruelle" className="mb-3 h-20 w-20" />
          <h1 className="text-xl font-bold">{titre}</h1>
          {sousTitre && <p className="mt-1 text-sm text-gray-500">{sousTitre}</p>}
        </div>
        <div className="carte border-t-4 border-t-sjr-primaire p-6">{children}</div>
      </div>
    </main>
  );
}
