# Entretiens SJR – Entretiens professionnels de la Ville de Saint-Jean-de-la-Ruelle

Application web de gestion des entretiens professionnels annuels : rédaction du compte rendu par le N+1, circuit de visas (agent → hiérarchie → agent), relances, PDF conforme au modèle de la Ville, exports pour l'archivage et le plan de formation.

- **Guide d'utilisation** : [docs/GUIDE_UTILISATION.md](docs/GUIDE_UTILISATION.md)
- **Guide de maintenance / mise en ligne** : [docs/GUIDE_MAINTENANCE.md](docs/GUIDE_MAINTENANCE.md)

## Démarrage rapide (données fictives)

```bash
npm install
cp .env.example .env.local
npm run db:reset    # base locale + données de démonstration
npm run dev         # http://localhost:3000 – RH : 100001 / demo1234
```

Stack : Next.js 15 · Drizzle ORM · Turso (libSQL) · @react-pdf/renderer · Tailwind CSS 4 · déploiement Vercel.
