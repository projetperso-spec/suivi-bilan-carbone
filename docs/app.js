/* Suivi du Bilan Carbone des collectivités.
   Auteur : Césarion Djonel, 2026.
   Tout se passe dans le navigateur, à partir de deux fichiers préparés par les scripts R :
   les bilans publiés sur la plateforme de l'ADEME et l'inventaire des émissions par commune. */
(function () {
  "use strict";

  // ---------- Réglages ----------
  const SEMBLABLE_MIN = 0.5, SEMBLABLE_MAX = 2;   // population entre la moitié et le double
  const SEMBLABLES_MINIMUM = 8;                   // en dessous, on élargit à toutes les méthodes
  const DELAI_RENOUVELLEMENT_ANS = 3;             // collectivités : bilan à refaire tous les trois ans

  // Postes de la méthode réglementaire (version 5), regroupés en thèmes lisibles par un service.
  const POSTES = {
    p11: "Chaudières et autres installations fixes (gaz, fioul)", p12: "Carburant des véhicules de la collectivité", p13: "Procédés hors énergie",
    p14: "Fuites de fluides frigorigènes", p15: "Biomasse (sols et forêts)", p21: "Électricité consommée", p22: "Chaleur, vapeur ou froid de réseau",
    p31: "Transport de marchandises en amont", p32: "Transport de marchandises en aval", p33: "Trajets domicile-travail des agents",
    p34: "Déplacements des visiteurs et des usagers", p35: "Déplacements professionnels", p41: "Achats de biens", p42: "Immobilisations (bâtiments, véhicules, équipements)",
    p43: "Déchets produits", p44: "Biens loués en amont", p45: "Achats de services", p51: "Utilisation des produits vendus", p52: "Biens loués en aval",
    p53: "Fin de vie des produits vendus", p54: "Investissements", p61: "Autres émissions indirectes",
  };
  const THEMES = [
    { id: "batiments", nom: "Énergie des bâtiments et éclairage public", postes: ["p11", "p21", "p22"], couleur: "#2a78d6" },
    { id: "flotte", nom: "Véhicules de la collectivité", postes: ["p12"], couleur: "#eb6834" },
    { id: "deplacements", nom: "Déplacements des agents et du public", postes: ["p33", "p34", "p35"], couleur: "#1baf7a" },
    { id: "achats", nom: "Achats de biens et de services", postes: ["p41", "p45", "p31", "p32"], couleur: "#4a3aa7" },
    { id: "travaux", nom: "Constructions, travaux et équipements", postes: ["p42", "p44"], couleur: "#eda100" },
    { id: "dechets", nom: "Déchets", postes: ["p43"], couleur: "#e87ba4" },
    { id: "autres", nom: "Autres postes", postes: ["p13", "p14", "p15", "p51", "p52", "p53", "p54", "p61"], couleur: "#9a9892" },
  ];
  const PILOTAGE = { id: "pilotage", nom: "Pilotage, formation, sensibilisation", couleur: "#14213d" };
  const AUTRE = { id: "autre", nom: "Non classée par l'outil", couleur: "#b9b7af" };
  // Classement d'une action dans un thème, d'après ses mots. L'ordre compte : le premier motif trouvé l'emporte.
  const MOTS_THEMES = [
    ["pilotage", /beges|bilan carbone|bilan des émissions|pilot|référent|\bform(er|ation)|sensibilis|gouvernance|grille|cohésion|comité|\bélus?\b|communi(quer|cation)|budget/i],
    ["flotte", /véhicule|flotte|carburant|parc auto|motorisation/i],
    ["deplacements", /mobilit|déplacement|transports? en commun|vélo|covoiturage|télétravail|travers|abords des écoles|piéton|cyclable/i],
    ["dechets", /déchet|compost|\btri\b|gaspillage/i],
    ["batiments", /rénovations? énergétiques?|énergétique|énergies?\b|\bcvc\b|chauffage|\bled\b|éclairage|isolation|renouvelable|thermique|photovolta|mutualis|consommations? (en |d')eau/i],
    ["travaux", /travaux|construction|démolition|opérations|chantier|bâtiment|aménag|matériaux/i],
    ["achats", /achat|marché|mobilier|reconditionn|numérique|\bneuf\b|économie circulaire|fournisseur|aliment|restauration|cantine|repas|clause|besoins|commande publique/i],
  ];
  // Indicateur de suivi proposé pour une action. Le premier motif trouvé l'emporte.
  const INDICATEURS = [
    [/\bled\b|éclairage public/i, "Consommation de l'éclairage public (kWh par an) ; part des points lumineux en LED (%)"],
    [/rénovations? énergétiques?|isolation/i, "Consommation des bâtiments rénovés (kWh par m² et par an) ; surface rénovée (m²)"],
    [/\bcvc\b|chauffage|installations/i, "Consommation de chauffage corrigée du climat (kWh par m² et par an)"],
    [/renouvelable|photovolta/i, "Part d'énergie renouvelable dans la consommation (%)"],
    [/consommations? (en |d')eau/i, "Consommation d'eau (m³ par an)"],
    [/mutualis/i, "Nombre de locaux partagés entre plusieurs usages ; surface de bâtiment par agent (m²)"],
    [/véhicule|flotte|carburant/i, "Carburant consommé (litres par an) ; part de véhicules électriques dans le parc (%)"],
    [/abords des écoles|travers|piéton|cyclable|mobilités douces/i, "Nombre de sites aménagés ; comptages de piétons et de cyclistes avant et après"],
    [/transports? en commun|mobilit|déplacement|covoiturage|télétravail|vélo/i, "Part des agents venant autrement que seuls en voiture (%), par enquête annuelle"],
    [/démolition|travaux|opérations|construction|chantier|bâtiment|aménag/i, "Part des opérations avec exigence environnementale ou bilan carbone du chantier (%)"],
    [/reconditionn|mobilier|\bneuf\b|réemploi|seconde main/i, "Part des achats de seconde main ou reconditionnés (%)"],
    [/numérique|informatique/i, "Durée de vie moyenne des équipements (années) ; nombre d'équipements achetés par an"],
    [/cartographie des achats|rationalis|besoins/i, "Montant des achats par famille (€), converti en tonnes de CO2 équivalent"],
    [/clause|marché|commande publique/i, "Part des marchés comportant une clause environnementale (%, en nombre et en montant)"],
    [/achat/i, "Montant des achats par famille (€), converti en tonnes de CO2 équivalent"],
    [/aliment|restauration|cantine|repas/i, "Part de repas végétariens servis (%) ; gaspillage alimentaire (grammes par repas)"],
    [/déchet|compost|\btri\b/i, "Tonnage de déchets produits par les services (tonnes par an) ; part valorisée (%)"],
    [/\bform(er|ation)|sensibilis/i, "Nombre d'élus et d'agents formés ; part des services touchés (%)"],
    [/référent/i, "Nombre de services dotés d'un référent"],
    [/grille|arbitr/i, "Part des projets examinés avec la grille avant décision (%)"],
    [/outils de collecte|collecte des? données/i, "Part des données du bilan fournies par les services dans les délais (%)"],
    [/pilot|grille|fusionn|cohésion|comité|gouvernance/i, "Nombre de comités de suivi tenus par an ; part des actions engagées (%)"],
  ];
  const SECTEURS = [["residentiel", "Logements (chauffage, eau chaude)"], ["tertiaire", "Bureaux, commerces, équipements"], ["routier", "Transport routier"],
    ["industrie", "Industrie"], ["energie", "Production d'énergie"], ["agriculture", "Agriculture"], ["dechets", "Traitement des déchets"], ["autres_transports", "Autres transports"]];

  const $ = (s) => document.querySelector(s);
  const fmt = (v, d = 0) => (v == null || !isFinite(v)) ? "n. d." : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (a, b, d = 0) => (b > 0 ? fmt(100 * a / b, d) + " %" : "n. d.");
  const tonnes = (v) => fmt(v) + " t";
  const pluriel = (n, mot, mots) => fmt(n) + " " + (n > 1 ? (mots || mot + "s") : mot);
  const echappe = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sansAccent = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Les textes publiés contiennent des balises et des caractères codés (&#039;) : on les remet en clair.
  const zone = document.createElement("textarea");
  function clair(texte) {
    if (!texte) return "";
    zone.innerHTML = String(texte).replace(/<br\s*\/?>|<\/p>|<\/li>/gi, "\n").replace(/<[^>]+>/g, " ");
    zone.innerHTML = zone.value;
    return zone.value.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  }
  function quantile(triees, q) {
    if (!triees.length) return NaN;
    const p = (triees.length - 1) * q, b = Math.floor(p);
    return triees[b] + (triees[Math.min(b + 1, triees.length - 1)] - triees[b]) * (p - b);
  }
  const barre = (v, max, v2) => `<td class="barre"><div style="width:${Math.max(0, Math.min(100, 100 * v / max))}%"></div>${v2 != null ? `<div class="part2" style="width:${Math.max(0, Math.min(100, 100 * v2 / max))}%"></div>` : ""}</td>`;

  // ---------- Lecture d'un bilan ----------
  const total = (b) => Object.keys(POSTES).reduce((s, p) => s + (b.emissions[p] || 0), 0);
  const duTheme = (b, t) => t.postes.reduce((s, p) => s + (b.emissions[p] || 0), 0);
  function themeAction(texte) { for (const [id, motif] of MOTS_THEMES) if (motif.test(texte)) return id; return "autre"; }
  function indicateur(texte) { for (const [motif, libelle] of INDICATEURS) if (motif.test(texte)) return libelle; return "À définir avec le service pilote"; }
  // Découpe le texte libre « Actions et moyens » en axes et en actions numérotées (1. 2. 3. …).
  function lirePlan(brut) {
    const texte = clair(brut);
    if (!texte) return { texte: "", actions: [] };
    const reperes = [];
    const motifAxe = /Axe\s*(\d+)\s*[-–—:]\s*/g, motifAction = /(?:^|[^\d,.])(\d{1,2})\s*[.)]\s+(?=\S)/g;
    let m, attendu = 1;
    while ((m = motifAxe.exec(texte))) reperes.push({ type: "axe", debut: m.index, fin: m.index + m[0].length, numero: +m[1] });
    while ((m = motifAction.exec(texte))) {
      if (+m[1] !== attendu) continue;
      const debut = m.index + m[0].indexOf(m[1]);
      reperes.push({ type: "action", debut, fin: m.index + m[0].length, numero: attendu });
      attendu++;
    }
    reperes.sort((a, b) => a.debut - b.debut);
    const actions = [];
    // Une action trop brève pour être classée (« rénovation de la piscine ») hérite du thème de son axe.
    const ajouter = (numero, axe, contenu) => { const t = themeAction(contenu); actions.push({ numero, axe, texte: contenu, theme: t === "autre" && axe ? themeAction(axe) : t, indicateur: indicateur(contenu) }); };
    let axe = "";
    const numerotees = reperes.filter((r) => r.type === "action").length;
    if (numerotees >= 3) {
      reperes.forEach((r, i) => {
        const suite = i + 1 < reperes.length ? reperes[i + 1].debut : texte.length;
        const contenu = texte.slice(r.fin, suite).replace(/\s+/g, " ").trim();
        if (r.type === "axe") axe = `Axe ${r.numero} – ${contenu}`;
        else if (contenu) ajouter(r.numero, axe, contenu);
      });
    } else if (reperes.length >= 2) {
      // Axes suivis d'une liste entre parenthèses : « Axe 1 : titre (action, action, action) ».
      reperes.forEach((r, i) => {
        const morceau = texte.slice(r.fin, i + 1 < reperes.length ? reperes[i + 1].debut : texte.length).replace(/\s+/g, " ").trim();
        const m = morceau.match(/^([^(]*)\((.*)\)[\s.;]*$/);
        if (!m) return;
        axe = `Axe ${r.numero} – ${m[1].trim()}`;
        for (const c of m[2].split(/,\s+|;\s+/)) if (c.trim().length > 5) ajouter(actions.length + 1, axe, c.trim());
      });
    } else {
      // Une action par ligne ou par tiret.
      const lignes = texte.split("\n").map((l) => l.replace(/^\s*[-•–—*·>]+\s*/, "").trim()).filter(Boolean);
      if (lignes.length >= 3) for (const l of lignes) {
        if (/:$/.test(l) || (l.length < 70 && /^(axe|volet|thème|objectif|pilier)\b/i.test(l))) axe = l.replace(/\s*:$/, "");
        else if (l.length >= 12 && l.length <= 320) ajouter(actions.length + 1, axe, l);
      }
    }
    const numerotation = numerotees >= 3 ? "publiée" : "ajoutée par l'outil";
    return { texte, actions: actions.length >= 3 ? actions : [], numerotation, intro: numerotees >= 3 && reperes.length ? texte.slice(0, reperes[0].debut).replace(/(\p{L})(\d+ actions?)/u, "$1 : $2").trim() : "" };
  }

  // ---------- Données ----------
  let donnees = null, territoires = null;
  const pret = Promise.all([
    fetch("data/bilans.json").then((r) => r.json()),
    fetch("data/territoires.tsv").then((r) => r.text()),
  ]).then(([b, t]) => {
    const parSiren = new Map();
    for (const x of b.bilans) {
      x.total = total(x);
      if (!parSiren.has(x.siren)) parSiren.set(x.siren, []);
      parSiren.get(x.siren).push(x);
    }
    for (const l of parSiren.values()) l.sort((p, q) => (q.annee - p.annee) || String(q.publication).localeCompare(String(p.publication)));
    donnees = { source: b.source, misAJour: b.misAJour, releve: b.releve, parSiren,
      collectivites: [...parSiren.values()].map((l) => l[0]).sort((p, q) => (q.population || 0) - (p.population || 0)) };
    const lignes = t.split("\n"), noms = lignes[0].trim().split("\t");
    territoires = new Map();
    for (let i = 1; i < lignes.length; i++) {
      if (!lignes[i]) continue;
      const v = lignes[i].trim().split("\t"), o = {};
      noms.forEach((n, k) => { o[n] = n === "insee" ? v[k] : +v[k]; });
      o.total = SECTEURS.reduce((s, [k]) => s + o[k], 0);
      territoires.set(o.siren, o);
    }
    $("#compte").textContent = `${fmt(b.bilans.length)} bilans publiés par ${fmt(parSiren.size)} collectivités, relevés le ${new Date(b.releve + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`;
  });

  // ---------- Recherche ----------
  const champ = $("#champ"), liste = $("#propositions");
  let propositions = [], actif = -1;
  function montrerPropositions() {
    liste.hidden = !propositions.length;
    liste.innerHTML = propositions.map((c, i) =>
      `<li role="option" data-i="${i}" aria-selected="${i === actif}"><span>${echappe(c.nom)}</span><small>${echappe(c.type || "collectivité")} · bilan ${c.annee}</small></li>`).join("");
  }
  champ.addEventListener("input", async () => {
    await pret;
    const q = sansAccent(champ.value.trim());
    propositions = q.length < 2 ? [] : donnees.collectivites.filter((c) => sansAccent(c.nom).includes(q)).slice(0, 8);
    actif = propositions.length ? 0 : -1;
    montrerPropositions();
  });
  champ.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!propositions.length) return;
      actif = (actif + (e.key === "ArrowDown" ? 1 : -1) + propositions.length) % propositions.length;
      montrerPropositions(); e.preventDefault();
    } else if (e.key === "Escape") { propositions = []; montrerPropositions(); }
  });
  $("#recherche").addEventListener("submit", (e) => { e.preventDefault(); if (propositions[actif]) choisir(propositions[actif].siren); });
  liste.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) choisir(propositions[+li.dataset.i].siren); });
  function choisir(siren) {
    propositions = []; montrerPropositions();
    if (location.hash === "#" + siren) afficher(siren); else location.hash = siren;
  }
  window.addEventListener("hashchange", depuisAdresse);
  function depuisAdresse() { const s = location.hash.replace("#", ""); if (/^\d{9}$/.test(s)) afficher(+s); }

  // ---------- Collectivités semblables ----------
  function semblables(b) {
    let tous = donnees.collectivites.filter((c) => c.siren !== b.siren && c.type === b.type && c.total > 0 && c.population > 0 &&
      (!b.population || (c.population >= b.population * SEMBLABLE_MIN && c.population <= b.population * SEMBLABLE_MAX)));
    const memeMethode = tous.filter((c) => c.methode === b.methode);
    const restreint = memeMethode.length >= SEMBLABLES_MINIMUM;
    if (restreint) tous = memeMethode;
    const stat = (f) => { const v = tous.map(f).filter((x) => isFinite(x)).sort((p, q) => p - q); return { q1: quantile(v, 0.25), mediane: quantile(v, 0.5), q3: quantile(v, 0.75), n: v.length, valeurs: v }; };
    return { liste: tous, restreint, stat };
  }

  // ---------- Téléchargement ----------
  const nombre = (v, d = 0) => (v == null || !isFinite(v)) ? "" : String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
  function telecharger(nom, lignes) {
    const texte = "﻿" + lignes.map((l) => l.map((c) => { const s = String(c == null ? "" : c); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texte], { type: "text/csv;charset=utf-8" }));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- Rédaction ----------
  async function afficher(siren) {
    await pret;
    const bilans = donnees.parSiren.get(siren);
    $("#accueil").hidden = true; $("#fiche").hidden = false;
    if (!bilans) { $("#fiche-contenu").innerHTML = `<p>Aucun bilan publié pour le numéro SIREN ${siren}. Seules les collectivités qui ont déposé leur bilan sur la plateforme de l'ADEME figurent ici.</p>`; window.__carbone = { termine: true, erreur: "inconnu" }; return; }
    const b = bilans[0], h = [], T = b.total;
    champ.value = b.nom; document.title = b.nom + " · Suivi du Bilan Carbone";
    const plan = lirePlan(b.actions), pairs = semblables(b), terr = territoires.get(siren);
    const parTheme = THEMES.map((t) => Object.assign({ valeur: duTheme(b, t), actions: plan.actions.filter((a) => a.theme === t.id).length }, t));
    const horsEmissions = [PILOTAGE, AUTRE].map((t) => Object.assign({ actions: plan.actions.filter((a) => a.theme === t.id).length }, t));
    const kgHab = (c, f) => 1000 * f(c) / c.population;
    const sTotal = b.population ? pairs.stat((c) => kgHab(c, (x) => x.total)) : null;
    const rang = sTotal && sTotal.n ? sTotal.valeurs.filter((v) => v < 1000 * T / b.population).length : null;
    const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const premier = [...parTheme].sort((p, q) => q.valeur - p.valeur)[0];
    const reduction = (b.reductionDirectes || 0) + (b.reductionIndirectes || 0);

    h.push(`<h2>${echappe(b.nom)}</h2>
      <p class="sous-titre">Suivi du Bilan Carbone · ${echappe(b.type || "collectivité")}${b.population ? " · " + fmt(b.population) + " habitants" : ""} · bilan de l'année ${b.annee}${b.publication ? ", publié le " + new Date(b.publication).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""} · établi le ${date} · outil conçu par Césarion Djonel</p>
      <div class="actions"><button id="imprimer">Imprimer ou enregistrer en PDF</button>${plan.actions.length ? '<button id="csv-plan">Tableau de suivi du plan (CSV pour Excel)</button>' : ""}<button id="csv-postes">Émissions par poste (CSV)</button></div>`);

    // En bref
    const s = [];
    s.push(`<b>${tonnes(T)} de CO2 équivalent</b> en ${b.annee}${b.population ? `, soit ${fmt(1000 * T / b.population)} kg par habitant` : ""}${b.agents ? ` et ${fmt(T / b.agents, 1)} t par agent` : ""}.`);
    if (T > 0) s.push(`Premier poste : <b>${premier.nom.toLowerCase()}</b>, ${pct(premier.valeur, T)} du bilan.`);
    if (sTotal && sTotal.n >= 3) s.push(`Par habitant, le bilan est ${1000 * T / b.population < sTotal.mediane ? "inférieur" : "supérieur"} à la médiane des ${sTotal.n} ${b.type === "Communes" ? "communes" : "collectivités"} de taille comparable (${fmt(sTotal.mediane)} kg) ; les périmètres comptés diffèrent d'une collectivité à l'autre.`);
    if (plan.actions.length) {
      const sousDotes = parTheme.filter((t) => T > 0 && t.valeur / T >= 0.15 && t.actions / plan.actions.length < t.valeur / T / 3);
      s.push(`Le plan de transition compte <b>${pluriel(plan.actions.length, "action")}</b>${sousDotes.length ? ` ; ${sousDotes.map((t) => `le thème « ${t.nom.toLowerCase()} » pèse ${pct(t.valeur, T)} des émissions pour ${pct(t.actions, plan.actions.length)} des actions`).join(", ")}` : ""}.`);
    } else s.push(b.actions ? "Le plan de transition est publié en texte libre, sans actions numérotées : l'outil ne peut pas le découper." : "Aucun plan de transition n'est publié avec ce bilan.");
    if (reduction) s.push(`Réduction attendue déclarée : ${tonnes(reduction)}, soit ${pct(reduction, T, 1)} du bilan.`);
    if (terr && terr.total) s.push(`Les émissions directes et d'énergie des services (${tonnes(duTheme(b, THEMES[0]) + duTheme(b, THEMES[1]))}) représentent ${pct(duTheme(b, THEMES[0]) + duTheme(b, THEMES[1]), terr.total, 1)} de celles du territoire communal.`);
    h.push(`<div class="synthese"><h3>En bref</h3><ul>${s.map((x) => `<li>${x}</li>`).join("")}</ul></div>`);

    // Plan de transition
    h.push(`<h3>Tableau de suivi du plan de transition</h3>`);
    if (plan.actions.length) {
      let axe = null;
      const lignes = plan.actions.map((a) => {
        const t = THEMES.concat([PILOTAGE, AUTRE]).find((x) => x.id === a.theme);
        const entete = a.axe !== axe ? `<tr class="axe"><td colspan="4">${echappe(a.axe || "Actions")}</td></tr>` : "";
        axe = a.axe;
        return `${entete}<tr><td class="num">${a.numero}</td><td>${echappe(a.texte)}</td><td><span class="theme" style="background:${t.couleur}"></span>${t.nom}</td><td>${echappe(a.indicateur)}</td></tr>`;
      });
      h.push(`${plan.intro ? `<p class="note">${echappe(plan.intro)}</p>` : ""}
        <div class="defile haut"><table class="actions-table"><thead><tr><th>N°</th><th>Action publiée par la collectivité</th><th>Thème d'émissions visé</th><th>Indicateur de suivi proposé par l'outil</th></tr></thead><tbody>${lignes.join("")}</tbody></table></div>
        <p class="note">Les actions sont celles que la collectivité a publiées${plan.numerotation === "publiée" ? "" : " en texte libre ; l'outil les a découpées et numérotées"}. Le thème et l'indicateur sont proposés par l'outil d'après les mots de chaque action : ce sont des points de départ à valider avec les services pilotes. L'export pour Excel ajoute les colonnes à remplir : valeur de départ, cible, pilote, échéance, état d'avancement.</p>`);
      const maxi = Math.max(...parTheme.map((t) => (T > 0 ? t.valeur / T : 0)), ...parTheme.concat(horsEmissions).map((t) => t.actions / plan.actions.length), 0.01);
      h.push(`<p><b>Le plan vise-t-il les postes qui pèsent ?</b></p>
        <div class="cle"><span>part des émissions</span><span class="b2">part des actions</span></div>
        <table><thead><tr><th>Thème</th><th class="n">Émissions</th><th class="n">Part des émissions</th><th class="n">Actions</th><th class="n">Part des actions</th><th></th></tr></thead><tbody>
        ${parTheme.map((t) => `<tr><td><span class="theme" style="background:${t.couleur}"></span>${t.nom}</td><td class="n">${tonnes(t.valeur)}</td><td class="n">${pct(t.valeur, T)}</td><td class="n">${t.actions}</td><td class="n">${pct(t.actions, plan.actions.length)}</td>${barre(T > 0 ? t.valeur / T : 0, maxi, t.actions / plan.actions.length)}</tr>`).join("")}
        ${horsEmissions.filter((t) => t.actions).map((t) => `<tr><td><span class="theme" style="background:${t.couleur}"></span>${t.nom}</td><td class="n">–</td><td class="n">–</td><td class="n">${t.actions}</td><td class="n">${pct(t.actions, plan.actions.length)}</td>${barre(0, maxi, t.actions / plan.actions.length)}</tr>`).join("")}</tbody></table>
        <p class="note">Un thème qui pèse lourd avec peu d'actions n'est pas forcément négligé : une seule action sur les marchés publics peut porter loin. Ce tableau sert à poser la question, pas à y répondre.</p>`);
    } else if (b.actions) h.push(`<blockquote>${echappe(plan.texte)}</blockquote><p class="note">Texte publié par la collectivité, non découpé par l'outil faute d'actions numérotées.</p>`);
    else h.push(`<p>La collectivité n'a pas renseigné la rubrique « Actions et moyens » de son bilan.</p>`);
    const objectifs = [["2030", b.objectif2030], ["2050", b.objectif2050], ["autre horizon", b.objectifAutre]].filter((o) => o[1]);
    if (reduction || objectifs.length) h.push(`<p><b>Objectifs déclarés.</b> ${reduction ? `Réduction attendue : ${tonnes(b.reductionDirectes || 0)} sur les émissions directes et ${tonnes(b.reductionIndirectes || 0)} sur les émissions indirectes, soit ${pct(reduction, T, 1)} du bilan. ` : ""}${objectifs.map((o) => `Objectif ${o[0]} : ${echappe(clair(o[1]))}.`).join(" ")}</p>`);
    h.push(`<p class="note">Une collectivité doit mettre à jour son bilan tous les ${DELAI_RENOUVELLEMENT_ANS} ans : le prochain portera au plus tard sur l'année ${b.annee + DELAI_RENOUVELLEMENT_ANS}. C'est à cette échéance que les indicateurs ci-dessus permettront de dire ce qui a changé.${b.analyse ? " Sur le bilan précédent, la collectivité indique : « " + echappe(clair(b.analyse)) + " »." : ""}</p>`);

    // Émissions
    const maxT = Math.max(1, ...parTheme.map((t) => t.valeur));
    h.push(`<h3>Où sont les émissions</h3><div class="tuiles">
      <div class="tuile"><div class="valeur">${tonnes(T)}</div><div class="libelle">de CO2 équivalent en ${b.annee}</div></div>
      ${b.population ? `<div class="tuile"><div class="valeur">${fmt(1000 * T / b.population)} kg</div><div class="libelle">par habitant</div></div>` : ""}
      ${b.agents ? `<div class="tuile"><div class="valeur">${fmt(T / b.agents, 1)} t</div><div class="libelle">par agent (${fmt(b.agents)} agents)</div></div>` : ""}
      <div class="tuile"><div class="valeur">${pct(premier.valeur, T)}</div><div class="libelle">${premier.nom.toLowerCase()}</div></div></div>
      <table><thead><tr><th>Thème et poste</th><th class="n">Émissions</th><th class="n">Part</th><th></th></tr></thead><tbody>
      ${parTheme.filter((t) => t.valeur > 0).sort((p, q) => q.valeur - p.valeur).map((t) => `<tr><td><span class="theme" style="background:${t.couleur}"></span><b>${t.nom}</b></td><td class="n"><b>${tonnes(t.valeur)}</b></td><td class="n"><b>${pct(t.valeur, T)}</b></td>${barre(t.valeur, maxT)}</tr>` +
        t.postes.filter((p) => b.emissions[p] > 0).map((p) => `<tr><td style="padding-left:26px">${POSTES[p]}</td><td class="n">${tonnes(b.emissions[p])}</td><td class="n">${pct(b.emissions[p], T)}</td><td></td></tr>`).join("")).join("")}</tbody></table>
      <p class="note">Tonnes de CO2 équivalent déclarées par la collectivité, méthode réglementaire ${b.methode === "v5" ? "version 5" : "version 4, ramenée par l'ADEME aux postes de la version 5"}. ${b.ecartes ? "Postes écartés par la collectivité : " + echappe(clair(b.ecartes)) + "." : ""}</p>`);

    // Comparaison
    if (b.population && pairs.liste.length >= 3) {
      const lignes = parTheme.filter((t) => t.id !== "autres").map((t) => {
        const st = pairs.stat((c) => kgHab(c, (x) => duTheme(x, t))), moi = 1000 * t.valeur / b.population;
        const comptent = pairs.liste.filter((c) => duTheme(c, t) > 0).length;
        return { t, st, moi, comptent };
      });
      const maxC = Math.max(...lignes.map((l) => Math.max(l.moi, l.st.q3 || 0)), 1);
      const absents = lignes.filter((l) => l.moi === 0 && l.comptent / pairs.liste.length >= 0.5);
      h.push(`<h3>Parmi les collectivités semblables</h3>
        <p>${pluriel(pairs.liste.length, "collectivité")} du même type, de ${fmt(b.population * SEMBLABLE_MIN)} à ${fmt(b.population * SEMBLABLE_MAX)} habitants${pairs.restreint ? ", ayant utilisé la même version de la méthode" : ", toutes versions de la méthode confondues"}. ${rang != null ? `${echappe(b.nom)} a un bilan par habitant plus élevé que ${pct(rang, sTotal.n)} d'entre elles.` : ""}</p>
        <div class="cle"><span>${echappe(b.nom)}</span><span class="b3">médiane des semblables</span></div>
        <table><thead><tr><th>Thème (kg de CO2 équivalent par habitant)</th><th class="n">${echappe(b.nom)}</th><th></th><th class="n">Médiane</th><th class="n">Quart bas – quart haut</th><th class="n">Semblables qui le comptent</th></tr></thead><tbody>
        ${lignes.map((l) => `<tr><td><span class="theme" style="background:${l.t.couleur}"></span>${l.t.nom}</td><td class="n">${fmt(l.moi)}</td><td class="barre"><div style="width:${Math.min(100, 100 * l.moi / maxC)}%"></div><div class="ref" style="width:${Math.min(100, 100 * l.st.mediane / maxC)}%"></div></td><td class="n">${fmt(l.st.mediane)}</td><td class="n">${fmt(l.st.q1)} – ${fmt(l.st.q3)}</td><td class="n">${pct(l.comptent, pairs.liste.length)}</td></tr>`).join("")}
        <tr><td><b>Ensemble du bilan</b></td><td class="n"><b>${fmt(1000 * T / b.population)}</b></td><td></td><td class="n"><b>${fmt(sTotal.mediane)}</b></td><td class="n">${fmt(sTotal.q1)} – ${fmt(sTotal.q3)}</td><td></td></tr></tbody></table>
        ${absents.length ? `<p><b>Postes à vérifier.</b> ${absents.map((l) => `${l.t.nom} n'est pas compté ici, alors que ${pct(l.comptent, pairs.liste.length)} des collectivités semblables le comptent`).join(" ; ")}.</p>` : ""}
        <p class="note">Comparaison indicative. Deux collectivités n'exercent pas les mêmes compétences (régie ou délégation, cuisine centrale, piscines…) et ne comptent pas les mêmes postes : un bilan élevé peut seulement signaler un bilan plus complet. La médiane et les quarts résistent aux déclarations aberrantes, qui existent dans la base.</p>
        <div class="defile"><table><thead><tr><th>Collectivité semblable</th><th class="n">Année</th><th class="n">Habitants</th><th class="n">Bilan</th><th class="n">kg par habitant</th></tr></thead><tbody>
        ${[...pairs.liste].sort((p, q) => kgHab(p, (x) => x.total) - kgHab(q, (x) => x.total)).map((c) => `<tr><td><a href="#${c.siren}">${echappe(c.nom)}</a></td><td class="n">${c.annee}</td><td class="n">${fmt(c.population)}</td><td class="n">${tonnes(c.total)}</td><td class="n">${fmt(kgHab(c, (x) => x.total))}</td></tr>`).join("")}</tbody></table></div>`);
    }

    // Évolution
    if (bilans.length > 1) {
      h.push(`<h3>D'un bilan à l'autre</h3>
        <table><thead><tr><th>Année</th><th>Méthode</th><th class="n">Bilan</th>${THEMES.slice(0, 6).map((t) => `<th class="n">${t.nom.split(/[ ,]/)[0]}</th>`).join("")}</tr></thead><tbody>
        ${bilans.map((x) => `<tr><td>${x.annee}</td><td>${x.methode || ""}</td><td class="n"><b>${tonnes(x.total)}</b></td>${THEMES.slice(0, 6).map((t) => `<td class="n">${fmt(duTheme(x, t))}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <p class="note">Tonnes de CO2 équivalent. Une hausse entre deux bilans vient souvent d'un périmètre élargi (achats, immobilisations) ou d'un changement de méthode, pas d'une hausse réelle : seuls les postes comptés de la même façon se comparent.</p>`);
    }

    // Territoire
    if (terr && terr.total) {
      const voisins = [...territoires.values()].filter((c) => c.population >= terr.population * SEMBLABLE_MIN && c.population <= terr.population * SEMBLABLE_MAX);
      const med = (k) => quantile(voisins.map((c) => 1000 * c[k] / c.population).sort((p, q) => p - q), 0.5);
      const maxS = Math.max(...SECTEURS.map(([k]) => Math.max(1000 * terr[k] / terr.population, med(k))), 1);
      const propres = duTheme(b, THEMES[0]) + duTheme(b, THEMES[1]);
      h.push(`<h3>La collectivité dans son territoire</h3>
        <p>Sur le territoire communal, les émissions directes atteignaient ${tonnes(terr.total)} de CO2 équivalent en 2016, soit ${fmt(terr.total / terr.population, 1)} t par habitant. Les bâtiments et les véhicules de la collectivité (${tonnes(propres)}) en représentent ${pct(propres, terr.total, 1)} : l'essentiel se joue dans les logements, les bureaux et les déplacements des habitants, c'est-à-dire dans le plan climat du territoire.</p>
        <div class="cle"><span>${echappe(b.nom)}</span><span class="b3">médiane des ${fmt(voisins.length)} communes de taille comparable</span></div>
        <table><thead><tr><th>Secteur (kg de CO2 équivalent par habitant, 2016)</th><th class="n">Territoire</th><th></th><th class="n">Médiane</th><th class="n">Tonnes</th></tr></thead><tbody>
        ${SECTEURS.filter(([k]) => terr[k] > 0).sort((p, q) => terr[q[0]] - terr[p[0]]).map(([k, nom]) => `<tr><td>${nom}</td><td class="n">${fmt(1000 * terr[k] / terr.population)}</td><td class="barre"><div style="width:${Math.min(100, 100000 * terr[k] / terr.population / maxS)}%"></div><div class="ref" style="width:${Math.min(100, 100 * med(k) / maxS)}%"></div></td><td class="n">${fmt(med(k))}</td><td class="n">${fmt(terr[k])}</td></tr>`).join("")}</tbody></table>
        <p class="note">Inventaire national réparti par commune (Citepa, année 2016, population actuelle). Il compte les émissions produites sur place ; le Bilan Carbone de la collectivité compte aussi les émissions indirectes de ses achats. Les deux ne s'additionnent pas : le rapprochement donne un ordre de grandeur.</p>`);
    }

    h.push(`<h3>Lire ces résultats</h3>
      <p class="note">Les chiffres sont ceux que chaque collectivité a déclarés sur la plateforme de l'ADEME (${echappe(donnees.source)}, base mise à jour le ${new Date(donnees.misAJour + "T12:00:00").toLocaleDateString("fr-FR")}). L'outil ne les recalcule pas et ne les corrige pas.</p>
      <p class="note">Les achats et les immobilisations sont estimés à partir des dépenses en euros, avec une incertitude forte : une baisse de ces postes peut venir d'un changement de prix ou de méthode. C'est pourquoi les indicateurs proposés sont physiques (kWh, litres, m², nombre d'équipements) : ils se mesurent chaque année, sans attendre le bilan suivant.</p>
      <p class="note">Le classement des actions par thème repose sur des mots-clés. Une action mal classée se corrige dans le tableau exporté.</p>`);
    $("#fiche-contenu").innerHTML = h.join("");

    $("#imprimer").onclick = () => window.print();
    if ($("#csv-plan")) $("#csv-plan").onclick = () => telecharger(`suivi_plan_transition_${siren}.csv`,
      [["numero", "axe", "action", "theme_emissions", "emissions_du_theme_tCO2e", "indicateur_propose", "valeur_de_depart", "cible", "pilote", "echeance", "etat_avancement", "commentaire"]]
        .concat(plan.actions.map((a) => { const t = parTheme.find((x) => x.id === a.theme); return [a.numero, a.axe, a.texte, t ? t.nom : (a.theme === "pilotage" ? PILOTAGE.nom : AUTRE.nom), t ? nombre(t.valeur) : "", a.indicateur, "", "", "", "", "", ""]; })));
    $("#csv-postes").onclick = () => telecharger(`emissions_par_poste_${siren}.csv`,
      [["annee", "theme", "poste", "libelle", "emissions_tCO2e"]].concat(bilans.flatMap((x) => THEMES.flatMap((t) => t.postes.map((p) => [x.annee, t.nom, p.replace("p", "").replace(/^(\d)/, "$1."), POSTES[p], nombre(x.emissions[p] || 0)])))));
    window.scrollTo(0, 0);
    window.__carbone = { termine: true, bilan: b, plan, parTheme, horsEmissions, pairs: pairs.liste.length, restreint: pairs.restreint, mediane: sTotal && sTotal.mediane, rang, territoire: terr };
  }

  window.__outils = { lirePlan, pret, donnees: () => donnees };   // pour les essais
  depuisAdresse();
})();
