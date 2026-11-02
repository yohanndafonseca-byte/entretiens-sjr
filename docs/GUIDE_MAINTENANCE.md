# Guide de maintenance – Entretiens professionnels

Pour la personne qui fait vivre l'application (RH), sans être développeuse.

---

## 1. Comment c'est construit

| Brique | Rôle | Où |
|---|---|---|
| **Next.js** (React) | L'application web (pages + serveur) | GitHub → hébergée sur **Vercel** |
| **Turso** (SQLite) | La base de données | turso.tech |
| **Vercel Cron** | Relances automatiques à 7 h, du lundi au vendredi | `vercel.json` |
| **SMTP** | Envoi des e-mails (Outlook / Microsoft 365 ou autre) | variables d'environnement |

Même pile que l'application de recrutement : même compte Vercel, même compte Turso (une base séparée).

Organisation du code :

```
src/lib/formulaire.ts   ← LE MODÈLE DU COMPTE RENDU (critères, libellés, échelle)
src/lib/pdf.tsx         ← la mise en page du PDF
src/lib/imports.ts      ← lecture des fichiers Inser / Ciril
src/lib/workflow.ts     ← circuit de visas, e-mails, finalisation
src/db/schema.ts        ← structure de la base de données
src/app/…               ← les pages
docs/                   ← ces guides
scripts/seed.ts         ← données FICTIVES de démonstration
```

---

## 2. Mise en ligne (première fois)

1. **GitHub** : créer un dépôt (ex. `entretiens-pro-sjr`) et y envoyer le dossier.
2. **Turso** : créer une base, par exemple en ligne de commande :

   ```bash
   turso db create entretiens-pro --location cdg
   ```

   Récupérer l'**URL** (`libsql://…`) et un **jeton** (`turso db tokens create entretiens-pro`). Choisir une région en Europe (Paris = `cdg`).
3. **Vercel** : *Add New → Project* → importer le dépôt GitHub. Dans *Settings → Environment Variables*, renseigner :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | `libsql://entretiens-pro-xxx.turso.io` |
   | `DATABASE_AUTH_TOKEN` | le jeton Turso |
   | `SESSION_SECRET` | une longue chaîne aléatoire (≥ 32 caractères) |
   | `APP_URL` | l'adresse finale, ex. `https://entretiens-sjr.vercel.app` |
   | `CRON_SECRET` | une autre chaîne aléatoire |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | voir § 4 |

4. Créer les tables dans Turso, une fois, depuis un poste qui a le code :

   ```bash
   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npx drizzle-kit push
   ```

5. **Premier compte RH** : la base de production est vide. Le plus simple est de lancer la démo une fois, puis de vider les données fictives ; ou de demander à Claude un petit script « créer l'administrateur ». Ensuite : Imports → Base agents, puis cocher « Administrateur RH » sur les bons agents.

> ⚠️ **Avant d'y mettre de vraies données** (prévu après la phase de test) : faire valider l'hébergement par la DSI et le délégué à la protection des données (DPO). Vercel et Turso sont des sociétés américaines, même avec des serveurs en Europe. L'application peut aussi tourner sur un serveur de la mairie (voir § 7).

---

## 3. Tester en local (sur un PC)

Prérequis : Node.js 20 ou plus.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run db:reset
```

```bash
npm run dev
```

Puis ouvrir http://localhost:3000.

`npm run db:reset` crée une base locale (`local.db`) avec des **données fictives** : 44 agents, campagnes 2025 et 2026.

| Compte de démo | Matricule | Mot de passe |
|---|---|---|
| RH (administratrice) | 100001 | demo1234 |
| DGS | 100002 | demo1234 |
| Autres agents | 800100 et suivants | demo1234, ou le code affiché dans « Imprimer les codes » |

---

## 4. E-mails

Sans configuration SMTP, **rien n'est envoyé** : les e-mails sont seulement visibles dans **Espace RH → E-mails**. C'est pratique pour tester.

Pour envoyer réellement, demander à la DSI un compte d'envoi. Pour Microsoft 365 / Outlook, par exemple :

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=entretiens-pro@ville-saintjeandelaruelle.fr
SMTP_PASSWORD=…
SMTP_FROM="Ressources Humaines <entretiens-pro@ville-saintjeandelaruelle.fr>"
```

E-mails envoyés automatiquement :
- « c'est à vous » à chaque étape ;
- relances après N jours sans action (N se règle dans la campagne) ;
- **PDF définitif** à l'agent après son dernier visa.

---

## 5. Modifications courantes

| Je veux… | Où |
|---|---|
| Changer un libellé de critère, en ajouter un | `src/lib/formulaire.ts` → `RUBRIQUES` |
| Changer les choix « Résultat obtenu » ou « Avis » | `src/lib/formulaire.ts` → `RESULTATS`, `AVIS` |
| Changer ce qui est obligatoire avant le visa du N+1 | `src/lib/formulaire.ts` → `verifierCompletude` |
| Modifier le texte des voies de recours ou la mise en page du PDF | `src/lib/pdf.tsx` |
| Modifier le texte des e-mails | `src/lib/workflow.ts` |
| Changer l'heure des relances | `vercel.json` (format cron, heure UTC) |
| Couleurs | `src/app/globals.css` (bloc `@theme`) |

**Ajouter un critère ne casse pas les anciens comptes rendus.** Les PDF des dossiers terminés sont figés et ne changent pas.

Après une modification : envoyer sur GitHub, et Vercel remet automatiquement l'application en ligne en 1 à 2 minutes. Si la **structure de la base** change (`src/db/schema.ts`), relancer `npx drizzle-kit push` vers Turso.

---

## 6. Sauvegardes et RGPD

- **Turso** fait des sauvegardes automatiques (retour à un instant passé, selon l'offre).
- En plus, chaque fin de campagne : **Exports → zip de tous les PDF** + **Excel de suivi**, copiés sur le serveur de la mairie. C'est l'archive officielle.
- Données stockées par agent : identité, matricule, e-mail, service, grade, poste, statut, temps de travail, échelon. **Aucune** donnée de salaire, d'adresse ou de date de naissance.
- Chaque action (visa, renvoi, modification de circuit, import) est tracée dans l'historique du dossier.
- Mots de passe : stockés chiffrés (bcrypt). Le code provisoire est visible par les RH tant que l'agent ne l'a pas remplacé, pour pouvoir l'imprimer.
- **À faire avec le DPO** : durée de conservation, inscription au registre des traitements, information des agents.

---

## 7. Limites connues et pistes

- **Hébergement interne possible** : c'est une application Node.js classique (`npm run build` puis `npm start`) et la base peut être un simple fichier (`DATABASE_URL=file:/chemin/entretiens.db`). Les relances se déclenchent alors par une tâche planifiée qui appelle `/api/cron/relances` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.
- **Connexion unique avec l'application de recrutement** : les deux applications utilisent la même pile technique. On peut les réunir dans un même portail RH (même identifiant) quand les deux seront stabilisées.
- **Signature** : le visa est une validation horodatée et tracée dans l'application, ce n'est pas une signature électronique qualifiée. Si la mairie s'équipe d'un parapheur électronique, les PDF définitifs pourront y être envoyés.
- **Liste des agents par import** : il n'y a pas de connexion automatique à Inser ou Ciril. On réimporte l'export, ce qui prend 30 secondes.
