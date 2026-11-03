// Tests de bout en bout dans un vrai navigateur (Playwright) : rédaction → visas → terminé, admin, imports, exports…
// Usage : npm run test:e2e  (lance d'abord l'application sur BASE_URL avec la base de démonstration : npm run db:reset)
const { createRequire } = require("module");
const path = require("path");
const req = createRequire(path.join(__dirname, "..", "package.json"));
const { chromium } = require("playwright");
const { createClient } = req("@libsql/client");
const ExcelJS = req("exceljs");
const fs = require("fs");
const JSZip = req("jszip");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = process.env.OUT_DIR || path.join(__dirname, "out");
const CRON = process.env.CRON_SECRET || "test-cron";
fs.mkdirSync(OUT, { recursive: true });
const db = createClient({ url: process.env.TEST_DATABASE_URL || `file:${path.join(__dirname, "..", "local.db")}` });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

let erreurs = [];
const ok = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ ") + msg); if (!cond) erreurs.push(msg); };

async function connexion(browser, matricule, mdp = "demo1234") {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: "fr-FR", acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erreurs.push("JS: " + e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE + "/connexion");
  await page.fill("#matricule", String(matricule));
  await page.fill("#motdepasse", mdp);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion")), page.click("button:has-text('Se connecter')")]);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();

  console.log("1. Connexion RH + tableau de bord");
  {
    const { ctx, page } = await connexion(browser, "100001");
    await page.goto(BASE + "/admin");
    ok(await page.isVisible("text=Tableau de bord – campagne 2026"), "tableau de bord affiché");
    await page.screenshot({ path: `${OUT}/01-dashboard.png`, fullPage: true });
    await page.goto(BASE + "/admin/dossiers?retard=1");
    await page.screenshot({ path: `${OUT}/02-dossiers.png`, fullPage: false });
    await ctx.close();
  }

  // Dossier vierge en rédaction dont l'agent a un mot de passe connu (pas de code provisoire)
  const [d] = await q(`select e.id, e.agent_id, e.redacteur_id, a.matricule am, r.matricule rm from entretiens e
    join agents a on a.id=e.agent_id join agents r on r.id=e.redacteur_id join campagnes c on c.id=e.campagne_id
    where c.annee=2026 and e.statut='redaction' and a.code_provisoire is null and a.email is not null
    and json_array_length(json_extract(e.contenu,'$.objectifs'))=0 limit 1`);
  console.log(`2. Rédaction par le N+1 (dossier ${d.id})`);
  {
    const { ctx, page } = await connexion(browser, d.rm);
    ok(await page.isVisible("text=À traiter"), "accueil N+1");
    await page.screenshot({ path: `${OUT}/03-accueil-n1.png`, fullPage: true });
    await page.goto(`${BASE}/entretiens/${d.id}`);
    ok((await page.locator("text=objectif(s) de l'an dernier sans résultat").count()) + (await page.locator("text=Aucun objectif n'avait").count()) > 0, "reprise objectifs N-1 / contrôle de complétude");
    ok(await page.isDisabled("button:has-text('Je vise le compte rendu')"), "visa bloqué tant que incomplet");
    await page.fill("#date", "2026-11-11");
    const selects = page.locator("#s-1 select");
    for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption("Réalisé");
    const boutons = page.locator("button[role=radio][title='Exigences du poste satisfaites']");
    const n = await boutons.count();
    for (let i = 0; i < n; i++) await boutons.nth(i).click();
    ok(n === 15, `15 critères (trouvé ${n})`);
    await page.click("#s-4 button:has-text('Ajouter un objectif')");
    await page.locator("#s-4 textarea").nth(0).fill("Mettre en place un tableau de suivi des demandes");
    await page.locator("#s-4 textarea").nth(1).fill("- Formation tableur\n- Point mensuel");
    await page.click("button:has-text('Ajouter un besoin de formation')");
    await page.locator("#s-5 select").last().selectOption("Agent");
    await page.locator("#s-5 textarea").last().fill("Excel perfectionnement");
    await page.locator("#s-5 input[list=liste-avis]").last().fill("Très favorable");
    await page.locator("#s-6 textarea").last().fill("Agent fiable et impliqué. Très bonne année.");
    await page.waitForSelector("text=Brouillon enregistré", { timeout: 10000 });
    ok(true, "enregistrement automatique");
    await page.reload();
    ok((await page.inputValue("#date")) === "2026-11-11", "brouillon persisté après rechargement");
    await page.click("button:has-text('Mode entretien')");
    await page.screenshot({ path: `${OUT}/04-mode-entretien.png` });
    await page.click("button:has-text('Quitter le mode entretien')");
    await page.screenshot({ path: `${OUT}/05-formulaire.png`, fullPage: true });
    await page.click("button:has-text('Je vise le compte rendu')");
    await page.waitForSelector("text=En attente du visa", { timeout: 15000 });
    ok(true, "visa N+1 → circuit");
    await ctx.close();
  }

  console.log("3. Circuit de visas");
  const etapes = await q(`select e.ordre, a.matricule, a.id from etapes e join agents a on a.id=e.acteur_id where entretien_id=? order by ordre`, [d.id]);
  for (const [i, et] of etapes.entries()) {
    const { ctx, page } = await connexion(browser, et.matricule);
    await page.goto(`${BASE}/entretiens/${d.id}`);
    if (i === 0) await page.screenshot({ path: `${OUT}/06-visa-agent.png`, fullPage: false });
    if (i === 1) {
      // test renvoi par le N+1 puis re-visa : on teste plutôt le renvoi au N+2 plus bas
    }
    await page.fill("aside textarea", i === 0 ? "Je remercie mon responsable pour cet échange." : "");
    await page.check("aside input[type=checkbox]");
    await page.click("aside button:has-text('Viser')");
    await page.waitForSelector("text=Visa enregistré", { timeout: 15000 });
    ok(true, `visa ${i + 1}/${etapes.length} (${et.matricule})`);
    await ctx.close();
  }
  const [fin] = await q(`select statut, pdf_envoye_le from entretiens where id=?`, [d.id]);
  ok(fin.statut === "termine", "dossier terminé");
  const mails = await q(`select type, sujet, corps from emails where entretien_id=? order by id`, [d.id]);
  ok(mails.some((m) => m.type === "final" && m.corps.includes("Pièce(s) jointe(s)")), "e-mail final avec PDF à l'agent");
  ok(mails.filter((m) => m.type === "tour").length >= etapes.length - 1, `e-mails de tour (${mails.filter((m) => m.type === "tour").length})`);

  console.log("4. PDF");
  {
    const { ctx, page } = await connexion(browser, d.am);
    const r = await page.request.get(`${BASE}/entretiens/${d.id}/pdf`);
    const buf = await r.body();
    ok(r.status() === 200 && buf.slice(0, 4).toString() === "%PDF", "PDF généré");
    fs.writeFileSync(`${OUT}/cr.pdf`, buf);
    await page.goto(`${BASE}/entretiens/${d.id}`);
    await page.screenshot({ path: `${OUT}/07-termine.png`, fullPage: false });
    await ctx.close();
  }

  console.log("5. Renvoi en rédaction par un N+2 + visa en présence + visa papier");
  {
    const [c] = await q(`select e.id, e.etape_courante, a.matricule am, a.id aid, (select ac.matricule from etapes et join agents ac on ac.id=et.acteur_id where et.entretien_id=e.id and et.ordre=e.etape_courante) cm,
      (select count(*) from etapes et where et.entretien_id=e.id and et.vise_le is not null) nv
      from entretiens e join agents a on a.id=e.agent_id join campagnes ca on ca.id=e.campagne_id where ca.annee=2026 and e.statut='circuit' and e.etape_courante>2 limit 1`);
    const { ctx, page } = await connexion(browser, c.cm);
    await page.goto(`${BASE}/entretiens/${c.id}`);
    await page.click("button:has-text('Renvoyer en rédaction')");
    await page.fill("aside textarea[placeholder='Motif (obligatoire)']", "Merci de préciser les objectifs");
    await page.click("button:has-text('Confirmer le renvoi')");
    await page.waitForSelector("text=Dossier renvoyé", { timeout: 15000 });
    const [apres] = await q(`select statut, (select count(*) from etapes where entretien_id=? and vise_le is not null) nv from entretiens where id=?`, [c.id, c.id]);
    ok(apres.statut === "redaction" && apres.nv === 0, "renvoi : retour en rédaction, visas annulés");
    await ctx.close();

    // visa en présence : dossier dont l'étape courante est l'agent (1re étape) avec agent à code provisoire
    const [p] = await q(`select e.id, r.matricule rm, a.code_provisoire code from entretiens e join agents a on a.id=e.agent_id join agents r on r.id=e.redacteur_id
      join campagnes ca on ca.id=e.campagne_id join etapes et on et.entretien_id=e.id and et.ordre=e.etape_courante
      where ca.annee=2026 and e.statut='circuit' and et.acteur_id=e.agent_id and a.code_provisoire is not null limit 1`);
    if (p) {
      const { ctx, page } = await connexion(browser, p.rm);
      await page.goto(`${BASE}/entretiens/${p.id}`);
      await page.click("button:has-text(\"Faire viser l'agent sur ce poste\")");
      await page.fill("input[placeholder=\"Code personnel de l'agent\"]", "MAUVAIS");
      await page.click("aside div.bg-gray-50 button:has-text('Viser')");
      await page.waitForSelector("text=Code personnel de l'agent incorrect");
      ok(true, "visa en présence : mauvais code refusé");
      await page.fill("input[placeholder=\"Code personnel de l'agent\"]", p.code);
      await page.click("aside div.bg-gray-50 button:has-text('Viser')");
      await page.waitForSelector("text=Visa de l'agent enregistré", { timeout: 15000 });
      ok(true, "visa en présence avec le code de l'agent");
      await ctx.close();
    } else console.log("  (pas de dossier pour le test en présence)");

    const [pp] = await q(`select e.id from entretiens e join campagnes ca on ca.id=e.campagne_id where ca.annee=2026 and e.statut='circuit' limit 1`);
    const rh = await connexion(browser, "100001");
    await rh.page.goto(`${BASE}/entretiens/${pp.id}`);
    await rh.page.click("button:has-text('Enregistrer un visa papier')");
    await rh.page.click("aside button:has-text('Enregistrer'):not(:has-text('papier'))");
    await rh.page.waitForSelector("text=Visa papier enregistré", { timeout: 15000 });
    ok(true, "visa papier saisi par les RH");
    await rh.ctx.close();
  }

  console.log("6. Imports (fichiers fictifs au format Inser)");
  {
    const entetes = "CODE NIVEAU 3;LIBELLE NIVEAU 3;CODE NIVEAU  4;LIBELLE NIVEAU 4;CODE NIVEAU 5;LIBELLE NIVEAU 5;CODE NIVEAU 6;LIBELLE NIVEAU 6;MATRICULE;NOM;PRENOM;NOM DE JEUNE FILLE;CODE TITRE;CODE STATUT;STATUT;CATEGORIE;CODE POSITION;POSITION;CODE;GRADE;CODE METIER;METIER;CODE FONCTION;FONCTION;CODE CADRE D’EMPLOI;CADRE D’EMPLOI;CODE FILIERE;FILIERE;SEXE;DATE DE NAISSANCE;DATE D’ENTREE FPT;DATE D’ENTREE COLLECTIVITE;DATE DE DEPART;TELEPHONE;FAX;PORTABLE;ADRESSE 1;ADRESSE 2;CODE POSTAL;VILLE;SALAIRE BRUT;SALAIRE NET;HORAIRE EN HEURE;EMAIL;TYPE TEMPS DE TRAVAIL;HORAIRE TEMPS DE TRAVAIL;TITULAIRE;EMPLOI 1;REMARQUE;CODE CENTRE DE COUT;CENTRE DE COUT;CODE PERSONNEL LIBRE 1;PERSONNEL LIBRE 1;CODE PERSONNEL LIBRE 2;PERSONNEL LIBRE 2;CODE PERSONNEL LIBRE 3;PERSONNEL LIBRE 3;PERSONNEL LIBRE 4;PERSONNEL LIBRE 5;DATE PERSONNEL LIBRE 1;DATE PERSONNEL LIBRE 2;EMAIL RESPONSABLE NIVEAU 3;EMAIL RESPONSABLE NIVEAU 4;EMAIL RESPONSABLE NIVEAU 5;EMAIL RESPONSABLE NIVEAU 6;RESPONSABLE NIVEAU 3;RESPONSABLE NIVEAU 4;RESPONSABLE NIVEAU 5;RESPONSABLE NIVEAU 6;DATE NOMINATION FIP;CODE FIP;DATE D’ENTREE GRADE;EMAIL COPIE;CODE ECHELON;ECHELON".split(";");
    const ligne = (vals) => entetes.map((h) => vals[h] ?? "").join(";");
    const L = [
      { "CODE NIVEAU 3": "D50", "LIBELLE NIVEAU 3": "DIRECTION DE LA CULTURE", "CODE NIVEAU  4": "P51", "LIBELLE NIVEAU 4": "MÉDIATHÈQUE", MATRICULE: "900001", NOM: "TESTEUR", PRENOM: "Hélène", STATUT: "TITULAIRE", CATEGORIE: "C", GRADE: "Adjoint du patrimoine", FONCTION: "Agent de médiathèque", EMAIL: "helene.testeur@exemple.fr", "TYPE TEMPS DE TRAVAIL": "Temps Plein", "SALAIRE BRUT": "2100", "DATE DE NAISSANCE": "01/01/1980", ECHELON: "4", "RESPONSABLE NIVEAU 4": "CHEFFE Zoé" },
      { "CODE NIVEAU 3": "D50", "LIBELLE NIVEAU 3": "DIRECTION DE LA CULTURE", "CODE NIVEAU  4": "P51", "LIBELLE NIVEAU 4": "MÉDIATHÈQUE", MATRICULE: "900002", NOM: "CHEFFE", PRENOM: "Zoé", STATUT: "TITULAIRE", CATEGORIE: "B", GRADE: "Assistant de conservation", FONCTION: "Responsable médiathèque", EMAIL: "" },
      { "CODE NIVEAU 3": "D40", "LIBELLE NIVEAU 3": "CCAS - CENTRE COMMUNAL D'ACTION SOCIALE", MATRICULE: "900003", NOM: "PARTI", PRENOM: "Paul", STATUT: "CONTRACTUEL", "DATE DE DEPART": "31/08/2026" },
    ];
    const csv = [entetes.join(";"), ...L.map(ligne)].join("\r\n");
    const fichierAgents = path.join(OUT, "export_agents.csv");
    fs.writeFileSync(fichierAgents, Buffer.from(csv, "latin1"));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Acteurs du workflow (Entretien)");
    ws.addRow(["Matricule de l'agent", null, null, "Code Type Entretien", "Matricule Acteur n° 1", null, "Matricule Acteur n° 2", null, "Matricule Acteur n° 3", null, "Matricule Acteur n° 4", null]);
    ws.addRow([900001, "TESTEUR", "Hélène", "EP", 900001, "TESTEUR", 900002, "CHEFFE", 100002, "LAMBERT", 900001, "TESTEUR"]);
    ws.addRow([900002, "CHEFFE", "Zoé", "EP", 900002, "CHEFFE", 100002, "LAMBERT", null, null, null, null]);
    ws.addRow([900009, "INCONNU", "Ivan", "EP", 900009, "INCONNU", 900002, "CHEFFE", 900009, "INCONNU"]);
    const fichierCircuits = path.join(OUT, "circuits.xlsx");
    await wb.xlsx.writeFile(fichierCircuits);

    const { ctx, page } = await connexion(browser, "100001");
    await page.goto(BASE + "/admin/import");
    await page.locator("input[type=file]").nth(0).setInputFiles(fichierAgents);
    await page.click("button:has-text('1. Voir ce qui va changer')");
    await page.waitForSelector("text=Aperçu : rien n'a encore été enregistré", { timeout: 15000 });
    ok((await q(`select count(*) n from agents where matricule='900001'`))[0].n === 0, "aperçu de l'import : rien n'est enregistré");
    ok((await page.textContent("main")).includes("TESTEUR Hélène"), "aperçu : nouveaux agents listés");
    await page.click("button:has-text('2. Importer')");
    await page.waitForSelector("text=Import terminé", { timeout: 15000 });
    const [h] = await q(`select nom, prenom, niv4, collectivite from agents where matricule='900001'`);
    ok(h && h.prenom === "Hélène" && h.niv4 === "MÉDIATHÈQUE", "CSV Windows-1252 avec accents importé");
    const [pa] = await q(`select actif, collectivite from agents where matricule='900003'`);
    ok(pa && pa.actif === 0 && pa.collectivite === "CCAS", "agent parti désactivé + détection CCAS");
    console.log("6b. Création automatique des dossiers (organigramme + dernier visa)");
    await page.click("button:has-text('1. Voir les circuits proposés')");
    await page.waitForSelector("text=Aperçu : rien n'est encore créé", { timeout: 30000 });
    await page.selectOption("select:near(:text('Seulement les alertes'))", "tout").catch(() => {});
    const apercu = await page.textContent("main");
    ok(apercu.includes("CHEFFE Zoé → LAMBERT Véronique"), "circuit calculé : N+1 de l'organigramme puis dernier visa (DGS)");
    await page.screenshot({ path: `${OUT}/12-generation.png`, fullPage: true });
    await page.click("button:has-text('2. Créer les dossiers')");
    await page.waitForSelector("text=Dossiers créés", { timeout: 60000 });
    const circ = await q(`select a.matricule m from etapes et join agents a on a.id=et.acteur_id join entretiens e on e.id=et.entretien_id join agents ag on ag.id=e.agent_id join campagnes c on c.id=e.campagne_id where ag.matricule='900001' and c.annee=2026 order by et.ordre`);
    ok(circ.map((x) => x.m).join(",") === "900001,900002,100002,900001", `dossier créé avec le bon circuit (${circ.map((x) => x.m).join(" → ")})`);

    await page.click("summary:has-text('Autre méthode')");
    await page.locator("input[type=file]").nth(1).setInputFiles(fichierCircuits);
    await page.click("button:has-text('Importer les circuits')");
    await page.waitForSelector("text=Points à vérifier", { timeout: 15000 });
    const txt = await page.textContent("main");
    ok(txt.includes("ne se termine pas par l'agent"), "anomalie « visa final manquant » détectée");
    ok(txt.includes("absent de la base agents"), "matricule inconnu signalé");
    await page.screenshot({ path: `${OUT}/08-import.png`, fullPage: true });
    const [nd] = await q(`select count(*) n from entretiens e join agents a on a.id=e.agent_id where a.matricule in ('900001','900002','900009')`);
    ok(nd.n === 3, "3 dossiers (création auto + import de circuits)");

    console.log("7. Exports");
    const [camp] = await q(`select id from campagnes where annee=2026`);
    for (const t of ["suivi", "formation", "voeux", "appreciations"]) {
      const r = await page.request.get(`${BASE}/api/export/excel?campagne=${camp.id}&type=${t}`);
      const b = await r.body();
      ok(r.status() === 200 && b.slice(0, 2).toString() === "PK", `Excel ${t}`);
      if (t === "formation") fs.writeFileSync(`${OUT}/formation.xlsx`, b);
    }
    const t0 = Date.now();
    const z = await page.request.get(`${BASE}/api/export/zip?campagne=${camp.id}`, { timeout: 120000 });
    const zb = await z.body();
    ok(z.status() === 200 && zb.slice(0, 2).toString() === "PK", `zip des PDF terminés (${Math.round(zb.length / 1024)} Ko, ${Date.now() - t0} ms)`);
    fs.writeFileSync(`${OUT}/export.zip`, zb);
    const zp = await page.request.get(`${BASE}/api/export/zip?campagne=${camp.id}&rangement=plat`, { timeout: 120000 });
    const archive = await JSZip.loadAsync(await zp.body());
    const noms = Object.keys(archive.files);
    ok(noms.includes("Sommaire.xlsx") && noms.some((n) => / - EP 2026 - entretien du \d{2}-\d{2}-2026\.pdf$/.test(n)), `zip « tout en un clic » : PDF nommés avec la date + Sommaire.xlsx (${noms.length - 1} PDF)`);
    await page.goto(BASE + "/admin/agents/codes");
    await page.screenshot({ path: `${OUT}/09-codes.png` });
    const [agentId] = await q(`select id from agents where matricule='900001'`);
    await page.goto(`${BASE}/admin/agents/${agentId.id}`);
    await page.screenshot({ path: `${OUT}/10-agent.png`, fullPage: true });
    await ctx.close();
  }

  console.log("7b. Remplacement en masse, visas papier en lot, exception de circuit");
  {
    const { ctx, page } = await connexion(browser, "100001");
    // chef de pôle avec des visas encore à donner
    const [chef] = await q(`select a.id, a.nom, a.prenom, count(*) n from etapes et join agents a on a.id=et.acteur_id join entretiens e on e.id=et.entretien_id
      where et.vise_le is null and e.statut!='termine' and a.poste='Responsable de pôle' and e.agent_id!=a.id group by a.id order by n desc limit 1`);
    const [remp] = await q(`select id, nom, prenom, matricule from agents where poste='Responsable de pôle' and id != ? limit 1`, [chef.id]);
    await page.goto(BASE + "/admin/remplacer");
    await page.locator("input[list=l-ancien]").fill((await q(`select nom||' '||prenom||' ('||matricule||')' l from agents where id=?`, [chef.id]))[0].l);
    await page.locator("input[list=l-nouveau]").fill(`${remp.nom} ${remp.prenom} (${remp.matricule})`);
    await page.click("button:has-text('Remplacer partout')");
    await page.waitForSelector("text=remplacé(e) par", { timeout: 20000 });
    const [reste] = await q(`select count(*) n from etapes et join entretiens e on e.id=et.entretien_id where et.acteur_id=? and et.vise_le is null and e.statut!='termine' and e.agent_id!=?`, [chef.id, chef.id]);
    ok(reste.n === 0, `remplacement en masse (${chef.n} visa(s) transférés)`);

    await page.goto(BASE + "/admin/papier");
    await page.screenshot({ path: `${OUT}/13-papier.png`, fullPage: true });
    const nbPapier = await page.locator("tbody tr").count();
    if (nbPapier > 0) {
      await page.click("thead input[type=checkbox]");
      const href = await page.getAttribute("a:has-text('Imprimer la sélection')", "href");
      const r = await page.request.get(BASE + href);
      const b = await r.body();
      ok(r.status() === 200 && b.slice(0, 4).toString() === "%PDF", `impression groupée : un seul PDF pour ${nbPapier} agent(s)`);
      await page.click("button:has-text('Enregistrer les visas reçus')");
      await page.waitForSelector("text=visa(s) papier enregistré(s)", { timeout: 30000 });
      ok(true, "visas papier enregistrés en lot");
    } else ok(false, "aucun dossier « visa papier » dans la démo");

    const [ag] = await q(`select id from agents where matricule='900001'`);
    await page.goto(`${BASE}/admin/agents/${ag.id}`);
    await page.click("button:has-text('Enregistrer le circuit')");
    await page.waitForSelector("text=Circuit mis à jour", { timeout: 15000 });
    const [cp] = await q(`select circuit_personnalise c from agents where id=?`, [ag.id]);
    ok(cp.c && JSON.parse(cp.c).length >= 1, "circuit gardé comme exception pour les prochaines campagnes");
    await ctx.close();
  }

  console.log("7d. Ajouter / supprimer un agent");
  {
    const { ctx, page } = await connexion(browser, "100001");
    const [chef] = await q(`select a.nom, a.prenom, a.matricule, a.id from agents a where a.poste='Responsable de pôle' and a.actif=1 and a.responsables is not null limit 1`);
    await page.goto(BASE + "/admin/agents/nouveau");
    await page.fill("#matricule", "777001");
    await page.fill("#nom", "Nouvel");
    await page.fill("#prenom", "Arrivant");
    await page.fill("#resp", `${chef.nom} ${chef.prenom} (${chef.matricule})`);
    await page.click("button:has-text(\"Ajouter l'agent\")");
    await page.waitForSelector("text=Agent ajouté", { timeout: 20000 });
    const circ = await q(`select a.matricule m, a.poste p from etapes et join agents a on a.id=et.acteur_id join entretiens e on e.id=et.entretien_id join agents ag on ag.id=e.agent_id where ag.matricule='777001' order by et.ordre`);
    ok(circ.length === 5 && circ[1].m === chef.matricule && circ[3].m === "100002", `agent ajouté + dossier créé, circuit déduit de son N+1 (${circ.map((x) => x.m).join(" → ")})`);
    await page.screenshot({ path: `${OUT}/16-agent-ajoute.png` });

    // suppression définitive (aucun compte rendu visé)
    await page.click("button:has-text(\"Supprimer l'agent\")");
    await page.waitForSelector("text=supprimé(e) définitivement", { timeout: 15000 });
    ok((await q(`select count(*) n from agents where matricule='777001'`))[0].n === 0, "agent sans historique supprimé définitivement");

    // refus : un responsable qui doit encore viser
    const [occupe] = await q(`select a.id from etapes et join agents a on a.id=et.acteur_id join entretiens e on e.id=et.entretien_id
      where et.vise_le is null and e.statut!='termine' and e.agent_id!=a.id and a.id != 1 group by a.id limit 1`);
    await page.goto(`${BASE}/admin/agents/${occupe.id}`);
    await page.click("button:has-text(\"Supprimer l'agent\")");
    await page.waitForSelector("text=doit encore intervenir", { timeout: 15000 });
    ok(true, "suppression refusée tant que la personne doit viser (lien « Remplacer »)");

    // archivage : agent avec un compte rendu terminé
    const [archi] = await q(`select a.id from agents a join entretiens e on e.agent_id=a.id where e.statut='termine'
      and a.id not in (select et.acteur_id from etapes et join entretiens e2 on e2.id=et.entretien_id where et.vise_le is null and e2.statut!='termine' and e2.agent_id!=et.acteur_id)
      and a.id not in (select redacteur_id from entretiens where statut='redaction' and redacteur_id is not null and agent_id!=redacteur_id)
      and a.id not in (select viseur_final_id from campagnes where viseur_final_id is not null) and a.is_admin=0 limit 1`);
    await page.goto(`${BASE}/admin/agents/${archi.id}`);
    await page.click("button:has-text(\"Supprimer l'agent\")");
    await page.waitForSelector("text=archivé(e)", { timeout: 15000 });
    const [etat] = await q(`select actif, hors_campagne h from agents where id=?`, [archi.id]);
    const [docs] = await q(`select count(*) n from entretiens where agent_id=? and statut='termine'`, [archi.id]);
    ok(etat.actif === 0 && etat.h === 1 && docs.n > 0, "agent avec comptes rendus archivé, documents conservés");
    await ctx.close();
  }

  console.log("7c. Convocation (décret : 8 jours) et visas en série");
  {
    const [c] = await q(`select e.id, r.matricule rm from entretiens e join agents r on r.id=e.redacteur_id join campagnes ca on ca.id=e.campagne_id
      where ca.annee=2026 and e.statut='redaction' and e.convocation_le is null limit 1`);
    const { ctx, page } = await connexion(browser, c.rm);
    await page.goto(`${BASE}/entretiens/${c.id}`);
    const local = (j) => { const d = new Date(Date.now() + j * 86400000); return d.toISOString().slice(0, 10) + "T10:00"; };
    await page.fill("input[name=quand]", local(3));
    await page.fill("input[name=lieu]", "Bureau 12");
    await page.click("button:has-text('Envoyer la convocation')");
    await page.waitForSelector("text=Le décret prévoit une convocation au moins 8 jours", { timeout: 15000 });
    ok(true, "convocation à moins de 8 jours refusée sans motif");
    await page.fill("input[name=quand]", local(12));
    await page.click("button:has-text('Envoyer la convocation')");
    await page.waitForSelector("text=Prévu le", { timeout: 20000 });
    const mails = await q(`select corps from emails where entretien_id=? and type='convocation'`, [c.id]);
    ok(mails.length >= 1 && mails[0].corps.includes("invitation.ics") && mails[0].corps.includes("Fiche d'entretien"), "convocation envoyée avec invitation agenda + fiche d'entretien");
    const r = await page.request.get(`${BASE}/entretiens/${c.id}/convocation`);
    ok(r.status() === 200 && (await r.body()).slice(0, 4).toString() === "%PDF", "lettre de convocation imprimable (agents sans e-mail)");
    await page.screenshot({ path: `${OUT}/14-convocation.png` });
    await ctx.close();

    const dgs = await connexion(browser, "100002");
    await dgs.page.goto(BASE + "/visas");
    const avant = await dgs.page.locator("input[aria-label^='Sélectionner']").count();
    await dgs.page.screenshot({ path: `${OUT}/15-visas-serie.png` });
    await dgs.page.click("label:has-text('Tout sélectionner') input");
    await dgs.page.click("label:has-text(\"J'ai pris connaissance\") input");
    await dgs.page.click("button:has-text('Viser la sélection')");
    await dgs.page.waitForSelector("text=visa(s) enregistré(s)", { timeout: 60000 });
    await dgs.page.waitForFunction(() => document.querySelectorAll("input[aria-label^='Sélectionner']").length === 0, null, { timeout: 15000 }).catch(() => {});
    const apres = await dgs.page.locator("input[aria-label^='Sélectionner']").count();
    ok(avant > 0 && apres === 0, `visas en série : ${avant} dossier(s) visé(s) en une fois`);
    await dgs.ctx.close();
  }

  console.log("7e. Accès : codes de campagne, mot de passe oublié, blocage");
  {
    const [ancien] = await q(`select matricule from agents where actif=1 and hors_campagne=0 and email is null and code_provisoire is null and is_admin=0 limit 1`);
    const { ctx, page } = await connexion(browser, "100001");
    await page.goto(BASE + "/admin/acces");
    await page.screenshot({ path: `${OUT}/17-acces.png`, fullPage: true });
    await page.click("button:has-text('Générer les nouveaux codes')");
    await page.waitForSelector("text=code(s) renouvelé(s)", { timeout: 60000 });
    const [n] = await q(`select count(*) n from agents where actif=1 and hors_campagne=0 and (profil_acces='sans_outil' or (profil_acces='auto' and email is null)) and code_genere_le > ?`, [Date.now() - 120000]);
    const fiches = await q(`select destinataire, corps from emails where sujet like 'Codes personnels de votre équipe%'`);
    ok(n.n > 0 && fiches.length > 0 && fiches.every((f) => f.corps.includes("Fiches codes personnels.pdf")), `${n.n} code(s) renouvelé(s), fiches PDF envoyées à ${fiches.length} responsable(s)`);
    const codes = (await q(`select code_provisoire c from agents where code_provisoire is not null and code_genere_le > ?`, [Date.now() - 120000])).map((x) => x.c);
    ok(codes.length > 0 && fiches.every((f) => codes.every((c) => !f.corps.includes(c))), "aucun code en clair dans le corps des e-mails (seulement dans le PDF joint)");
    const r = await page.request.get(BASE + "/api/export/codes");
    ok(r.status() === 200 && (await r.body()).slice(0, 4).toString() === "%PDF", "fiches de code imprimables (PDF)");
    await ctx.close();
    // l'ancien mot de passe d'un agent sans outil ne fonctionne plus
    const p2 = await (await browser.newContext()).newPage();
    await p2.goto(BASE + "/connexion");
    await p2.fill("#matricule", ancien.matricule);
    await p2.fill("#motdepasse", "demo1234");
    await p2.click("button:has-text('Se connecter')");
    await p2.waitForSelector("text=incorrect", { timeout: 10000 });
    ok(true, "ancien mot de passe d'un agent sans outil désactivé");

    // blocage après 5 essais
    const [cible] = await q(`select matricule from agents where email is not null and is_admin=0 and actif=1 and matricule like '8%' order by matricule desc limit 1`);
    for (let i = 0; i < 5; i++) {
      await p2.goto(BASE + "/connexion");
      await p2.fill("#matricule", cible.matricule);
      await p2.fill("#motdepasse", "mauvais" + i);
      await p2.click("button:has-text('Se connecter')");
      await p2.waitForSelector(".bg-red-50", { timeout: 10000 });
    }
    await p2.goto(BASE + "/connexion");
    await p2.fill("#matricule", cible.matricule);
    await p2.fill("#motdepasse", "demo1234");
    await p2.click("button:has-text('Se connecter')");
    await p2.waitForSelector("text=compte bloqué", { timeout: 10000 });
    ok(true, "compte bloqué 15 min après 5 essais, même avec le bon mot de passe");

    // mot de passe oublié (agent avec e-mail)
    const [oubli] = await q(`select matricule from agents where email is not null and is_admin=0 and actif=1 and matricule like '8%' order by matricule desc limit 1 offset 1`);
    await p2.goto(BASE + "/connexion");
    await p2.click("text=Mot de passe ou code oublié");
    await p2.fill("#identifiant", oubli.matricule);
    await p2.click("button:has-text('Recevoir un lien')");
    await p2.waitForSelector("text=Si un e-mail est associé", { timeout: 10000 });
    const [mail] = await q(`select corps from emails where sujet like '%choisir un nouveau mot de passe' order by id desc limit 1`);
    const lien = mail.corps.match(/\/reinitialiser\?jeton=[0-9a-f]+/)[0];
    await p2.goto(BASE + lien);
    await p2.fill("#nouveau", "NouveauMdp2026");
    await p2.fill("#confirmation", "NouveauMdp2026");
    await p2.click("button:has-text('Enregistrer et me connecter')");
    await p2.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
    ok(true, "mot de passe oublié : lien par e-mail, nouveau mot de passe, connexion");
    await p2.goto(BASE + lien);
    await p2.fill("#nouveau", "Encore2026xx");
    await p2.fill("#confirmation", "Encore2026xx");
    await p2.click("button:has-text('Enregistrer et me connecter')");
    await p2.waitForSelector("text=n'est plus valable", { timeout: 10000 });
    ok(true, "lien de réinitialisation utilisable une seule fois");
  }

  console.log("8. Sécurité");
  {
    const { ctx, page } = await connexion(browser, "900001", (await q(`select code_provisoire c from agents where matricule='900001'`))[0].c);
    ok(page.url().includes("/mot-de-passe"), "1re connexion → changement de mot de passe obligatoire");
    await page.goto(BASE + "/admin");
    ok(page.url().includes("/mot-de-passe"), "pas d'accès avant changement");
    await ctx.close();
    const ag = await connexion(browser, d.am);
    await ag.page.goto(BASE + "/admin");
    ok(!ag.page.url().includes("/admin"), "agent non RH redirigé hors de /admin");
    const [autre] = await q(`select id from entretiens where agent_id != ? and id not in (select entretien_id from etapes where acteur_id=?) and redacteur_id != ? limit 1`, [d.agent_id, d.agent_id, d.agent_id]);
    const r = await ag.page.request.get(`${BASE}/entretiens/${autre.id}/pdf`);
    ok(r.status() === 404, "pas d'accès au PDF d'un autre agent");
    const r2 = await ag.page.request.get(`${BASE}/api/export/excel?campagne=1`);
    ok(r2.status() === 403, "exports interdits aux non-RH");
    await ag.ctx.close();
    const c1 = await fetch(`${BASE}/api/cron/relances`);
    ok(c1.status === 401, "cron refusé sans secret");
    const c2 = await fetch(`${BASE}/api/cron/relances`, { headers: { authorization: `Bearer ${CRON}` } });
    const j = await c2.json();
    ok(c2.status === 200 && j.relances > 0 && j.emails > 0 && j.emails < j.relances, `relances regroupées : ${j.relances} dossier(s) en ${j.emails} e-mail(s)`);
  }

  console.log("9. Mobile");
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/connexion");
    await page.fill("#matricule", d.am);
    await page.fill("#motdepasse", "demo1234");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion")), page.click("button:has-text('Se connecter')")]);
    await page.goto(`${BASE}/entretiens/${d.id}`);
    await page.screenshot({ path: `${OUT}/11-mobile.png` });
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(largeur <= 400, `pas de défilement horizontal sur mobile (${largeur}px)`);
    await ctx.close();
  }

  await browser.close();
  console.log(erreurs.length ? `\n${erreurs.length} PROBLÈME(S) :\n- ` + erreurs.join("\n- ") : "\nTOUT EST OK");
  process.exit(erreurs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
