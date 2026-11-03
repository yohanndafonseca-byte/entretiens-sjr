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

Même hébergeur (Vercel, région Dublin) et même base (Turso, une base séparée) que l'application Recrutement (`prototype-sjr-recrutement`), même charte graphique. Le code est plus récent (Next.js 15, TypeScript) : à harmoniser si les deux applications sont un jour réunies.

Organisation du code :

```
src/lib/formulaire.ts   ← LE MODÈLE DU COMPTE RENDU (critères, libellés, échelle)
src/lib/pdf.tsx         ← la mise en page du PDF
src/lib/imports.ts      ← lecture des fichiers Inser / Ciril
src/lib/workflow.ts     ← circuit de visas, e-mails, finalisation
src/lib/circuits.ts     ← calcul automatique des circuits (exception > an dernier > organigramme)
src/lib/convocation.ts  ← convocation (délai de 8 jours, invitation agenda)
src/db/schema.ts        ← structure de la base de données
src/app/…               ← les pages
docs/                   ← ces guides
scripts/seed.ts         ← données FICTIVES de démonstration
tests/e2e.cjs           ← tests automatiques dans un vrai navigateur (lancés par GitHub à chaque envoi)
```

---

## 2. Mise en ligne (première fois) – sans aucune commande

1. **Turso** (https://app.turso.tech, même compte que le recrutement) → *Create Database* :
   - nom : `entretiens-sjr`, région **Europe** ;
   - copier l'**URL** (`libsql://entretiens-sjr-….turso.io`) ;
   - *Create Token* → copier le **jeton**.
2. **Vercel** (même compte que le recrutement) → *Add New… → Project* → importer **`entretiens-sjr`** depuis GitHub.
3. Avant de cliquer sur *Deploy*, ouvrir **Environment Variables** et ajouter :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | l'URL Turso (`libsql://…`) |
   | `DATABASE_AUTH_TOKEN` | le jeton Turso |
   | `SESSION_SECRET` | une longue phrase aléatoire (32 caractères minimum) |
   | `CRON_SECRET` | une autre phrase aléatoire |
   | `APP_URL` | l'adresse du site, ex. `https://entretiens-sjr.vercel.app` (à corriger après le 1er déploiement si besoin) |
   | `ADMIN_MATRICULE` | ton matricule |
   | `ADMIN_PASSWORD` | un mot de passe provisoire (8 caractères minimum) |
   | `SMTP_…` | facultatif pour commencer, voir § 4 |

4. **Deploy**. Les tables de la base sont créées automatiquement pendant le déploiement.
5. Ouvrir le site et se connecter avec `ADMIN_MATRICULE` / `ADMIN_PASSWORD`. L'application crée le compte RH et demande de choisir un vrai mot de passe. Ces deux variables ne servent plus ensuite : elles ne fonctionnent que tant qu'aucun administrateur n'existe.
6. Dans l'application : **Campagnes** → créer la campagne, puis suivre la **liste de contrôle** affichée (base agents, création des dossiers, codes…). Sur la fiche de chaque collègue RH, cocher « Administrateur RH ».

Les relances automatiques (7 h UTC, du lundi au vendredi) sont activées automatiquement par Vercel grâce à `vercel.json`.

> ⚠️ **Avant d'y mettre de vraies données** (prévu après la phase de test) : faire valider l'hébergement par la DSI et le délégué à la protection des données (DPO). Vercel et Turso sont des sociétés américaines, même avec des serveurs en Europe. L'application peut aussi tourner sur un serveur de la mairie (voir § 7).
>
> Le dépôt GitHub est **public** : le code est visible par tous. Il ne contient aucune donnée ni aucun mot de passe, mais il est préférable de le passer en **privé** (GitHub → Settings → Danger Zone → Change visibility). Vercel continue de fonctionner.

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

## 3 bis. Tests automatiques

À chaque envoi sur GitHub, l'onglet **Actions** du dépôt lance automatiquement les tests : vérification du code, build, puis le parcours complet dans un vrai navigateur (convocation, rédaction, visas, imports, exports, droits d'accès…). Une coche verte ✓ signifie que tout fonctionne ; une croix rouge ✗ signale qu'une modification a cassé quelque chose (les captures d'écran sont téléchargeables dans le détail).

En local, avec l'application lancée sur le port 3100 :

```bash
npm run test:e2e
```

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
- convocation à l'entretien, avec l'invitation agenda (.ics) et les pièces jointes ;
- relances après N jours sans action (N se règle dans la campagne), **regroupées en un seul e-mail par personne** ;
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
| Couleurs (charte commune avec Recrutement) | `src/app/globals.css` (bloc `@theme`) |

**Ajouter un critère ne casse pas les anciens comptes rendus.** Les PDF des dossiers terminés sont figés et ne changent pas.

Après une modification : envoyer sur GitHub, et Vercel remet automatiquement l'application en ligne en 1 à 2 minutes. Si la **structure de la base** change (`src/db/schema.ts`), lancer `npm run db:generate` et envoyer le nouveau fichier du dossier `drizzle/` : la base Turso est mise à jour automatiquement au déploiement suivant.

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
