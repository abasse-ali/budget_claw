// ============================================================
// app.js - Logique de l'appli budget
// Utilise window.entries (kit) pour stocker les opérations du mois
// et localStorage pour le plan (rentrées/charges récurrentes)
// ============================================================

(() => {
  // ---- CONFIGURATION DU PLAN (valeurs par défaut du brief) ----
  const PLAN_KEY = "budget-plan";

  const startPlan = {
    incomes: [
      { id: "salaire", label: "Salaire", min: 1235.15, max: 1235.15, sure: true, category: "Salaire" },
      { id: "mobili", label: "Mobili-Jeune", min: 100, max: 100, sure: true, category: "Aides" },
      { id: "caf", label: "CAF", min: 103, max: 206, sure: true, category: "CAF & Aides" },
      { id: "especes", label: "Espèces", min: 80, max: 200, sure: false, category: "Espèces & Divers" },
    ],
    charges: [
      { id: "loyer", label: "Loyer", amount: 450, category: "Logement", note: "Charges comprises" },
      { id: "forfait", label: "Forfait mobile", amount: 10, category: "Télécom & Web", note: "Mensuel" },
      { id: "claude", label: "Claude AI", amount: 21.60, category: "Services IA", note: "Mensuel" },
      { id: "transport", label: "Transport", amount: 8, category: "Transports", note: "Remboursé 50% Orange (16 €)" },
      { id: "alimentaire", label: "Alimentaire", amount: 100, category: "Alimentation", note: "Budget strict" },
    ],
  };

  // ---- HELPERS ----
  const thisMonthKey = () => window.entries.today().slice(0, 7); // "YYYY-MM"

  const loadPlan = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(PLAN_KEY));
      if (stored && stored.incomes && stored.charges) {
        // Migration : ajouter start si absent
        if (!stored.start) stored.start = thisMonthKey();
        return stored;
      }
    } catch (_) { /* plan illisible : celui de départ */ }
    return { ...structuredClone(startPlan), start: thisMonthKey() };
  };

  const savePlan = () => {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    } catch (_) { /* quota dépassé */ }
  };

  // Formatage montants : "1 235,15 €" ou "1 235 €" sans centimes si entier
  const fmt = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0,00 €";
    // Toujours 2 décimales pour cohérence visuelle
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  };

  // Format court pour les ranges : "103 à 206 €" ou "1 235 €"
  const fmtShort = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n).replace(/\s*€\s*$/, "");
  };

  const rangeText = (item) => {
    if (item.min === item.max) return fmt(item.min);
    return `${fmtShort(item.min)} à ${fmtShort(item.max)} €`;
  };

  // Afficher un texte dans tous les [data-show="name"]
  const show = (name, text) => {
    document.querySelectorAll(`[data-show="${name}"]`).forEach((node) => {
      node.textContent = text;
    });
  };

  // ---- PLAN & STATE ----
  let plan = loadPlan();
  savePlan(); // assure start

  // ---- CALCULS DES CHIFFRES CLÉS ----
  const computeFigures = () => {
    const month = window.entries.totals(window.entries.month());
    const sureIncome = plan.incomes.filter(i => i.sure).reduce((sum, i) => sum + i.min, 0);
    const sureBest = plan.incomes.filter(i => i.sure).reduce((sum, i) => sum + i.max, 0);
    const unsureMin = plan.incomes.filter(i => !i.sure).reduce((sum, i) => sum + i.min, 0);
    const unsureMax = plan.incomes.filter(i => !i.sure).reduce((sum, i) => sum + i.max, 0);
    const fixed = plan.charges.reduce((sum, c) => sum + c.amount, 0);

    // Prudent = revenus sûrs (min) - charges fixes + opérations du mois
    const prudent = sureIncome - fixed + month.income - month.spending;
    // Habituel = prudent + espèces min
    const habit = prudent + unsureMin;
    // Max = revenus sûrs (max) + espèces max - charges + opérations
    const best = sureBest + unsureMax - fixed + month.income - month.spending;
    // Budget dispo ce mois = revenus sûrs - charges + rentrées du mois
    const budget = sureIncome - fixed + month.income;

    return {
      sure: sureIncome,
      fixed,
      month,
      prudent,
      habit,
      best,
      budget,
      unsureMax,
      unsureMin,
      sureBest,
    };
  };

  // ---- RENDU PRINCIPAL (Aperçu) ----
  const render = () => {
    const f = computeFigures();
    const now = new Date();
    const [year, monthNum] = window.app.month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const currentDay = window.app.month === thisMonthKey() ? now.getDate() : daysInMonth;
    const daysLeft = daysInMonth - currentDay + 1;

    // Hero
    show("left", fmt(f.prudent));
    show("best", fmt(f.best));
    show("per-day", fmt(Math.max(0, f.prudent) / Math.max(1, daysLeft)));
    show("days-left", `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`);

    const usedPct = f.budget > 0 ? Math.min(100, Math.round((f.month.spending / f.budget) * 100)) : 0;
    show("used", `${usedPct} % du budget dépensé`);
    show("budget", fmt(f.budget));
    const bar = document.querySelector('[data-show="used-bar"]');
    if (bar) {
      bar.style.setProperty("--value", `${usedPct}%`);
      bar.parentElement.setAttribute("aria-valuenow", String(usedPct));
    }

    // Tiles
    show("sure", fmt(f.sure));
    show("unsure", `+ jusqu'à ${fmt(f.unsureMax)} non assurés`);
    show("fixed", fmt(f.fixed));
    show("fixed-count", `${plan.charges.length} charges chaque mois`);
    show("incomes-count", `${plan.incomes.length} prévues`);
    show("charges-count", `${fmt(f.fixed)} par mois`);

    // Résumé du mois
    const totalPrevu = f.sure + f.unsureMax;
    const opsNet = f.month.income - f.month.spending;
    show("summary-total", fmt(totalPrevu));
    show("summary-fixed", fmt(f.fixed));
    show("summary-ops", opsNet >= 0 ? `+${fmt(opsNet)}` : fmt(opsNet));
    show("summary-prudent", fmt(f.prudent));
    show("summary-habit", fmt(f.habit));
    show("summary-best", fmt(f.best));

    // Tiles Analyse
    show("total-fixed", fmt(f.fixed));
    show("max-margin", fmt(f.best));

    // Listes du plan (charges & revenus)
    for (const list of document.querySelectorAll("[data-plan]")) {
      const kind = list.dataset.plan;
      const data = kind === "variables" 
        ? plan.incomes.filter(i => !i.sure || i.min !== i.max)
        : plan[kind];
      if (data) {
        list.replaceChildren(...data.map((item) => planRow(item, kind)));
      }
    }

    // Variables (onglet Analyse)
    const variablesList = document.querySelector('[data-plan="variables"]');
    if (variablesList) {
      variablesList.replaceChildren(...plan.incomes.filter(i => !i.sure || i.min !== i.max).map(item => variableRow(item)));
    }

    // Scénarios (Bilan)
    const scenarios = document.querySelector('[data-show="scenarios"]');
    if (scenarios) {
      const top = Math.max(f.best, f.habit, f.prudent, 1);
      const meterHtml = (name, value, note) => `
        <div class="meter">
          <div class="meter__head"><span class="meter__name">${name}</span><span class="meter__value">${fmt(value)}</span></div>
          <div class="meter__track"><i style="--value: ${Math.max(0, Math.round((value / top) * 100))}%"></i></div>
          <p class="meter__note">${note}</p>
        </div>`;
      scenarios.innerHTML = meterHtml("Prudent", f.prudent, "CAF au plus bas, sans les espèces")
        + meterHtml("Habituel", f.habit, "avec les espèces au plus bas")
        + meterHtml("Au mieux", f.best, "CAF et espèces au plus haut");
    }
  };

  // ---- LIGNES DU PLAN (charges & revenus) ----
  const planRow = (item, kind) => {
    const row = document.createElement("li");
    row.className = "row";
    const income = kind === "incomes";
    const amount = income ? rangeText(item) : fmt(item.amount);
    const iconSvg = window.entries.iconFor(item.category, item.label);
    row.innerHTML = `<span class="row__icon ${income ? "row__icon--in" : ""}">${iconSvg}</span><span class="row__main"><span class="row__title"><span class="row__text"></span></span><span class="row__sub"></span></span><span class="row__end"><span class="row__amount"></span></span>`;
    const title = row.querySelector(".row__title");
    title.querySelector(".row__text").textContent = item.label;
    if (income && !item.sure) title.insertAdjacentHTML("beforeend", '<span class="badge badge--unsure">pas sûr</span>');
    else if (income && item.min !== item.max) title.insertAdjacentHTML("beforeend", '<span class="badge badge--accent">variable</span>');
    row.querySelector(".row__sub").textContent = item.note || (income ? (item.sure ? "Chaque mois" : "Compté une fois reçu") : "Chaque mois");
    const end = row.querySelector(".row__amount");
    end.textContent = income ? `+${amount}` : `−${amount}`;
    end.classList.toggle("row__amount--in", income);
    return row;
  };

  // Ligne pour variables (onglet Analyse)
  const variableRow = (item) => {
    const row = document.createElement("li");
    row.className = "row";
    const iconSvg = window.entries.iconFor(item.category, item.label);
    const label = item.sure ? "Variable" : "Non assuré";
    const amount = rangeText(item);
    row.innerHTML = `<span class="row__icon row__icon--in">${iconSvg}</span><span class="row__main"><span class="row__title"><span class="row__text"></span></span><span class="row__sub"></span></span><span class="row__end"><span class="row__amount"></span></span>`;
    const title = row.querySelector(".row__title");
    title.querySelector(".row__text").textContent = item.label;
    title.insertAdjacentHTML("beforeend", `<span class="badge badge--${item.sure ? "accent" : "unsure"}">${label}</span>`);
    row.querySelector(".row__sub").textContent = item.note || "Compté une fois reçu";
    const end = row.querySelector(".row__amount");
    end.textContent = `+${amount}`;
    end.classList.add("row__amount--in");
    return row;
  };

  // ---- RÉGLAGES (Settings) ----
  const settingRow = (item, kind, field) => {
    const row = document.createElement("div");
    row.className = "setting";
    const id = `reglage-${item.id}-${field}`;
    row.innerHTML = `<label class="setting__name" for="${id}"></label><div class="money"><input id="${id}" inputmode="decimal" autocomplete="off"><span aria-hidden="true">€</span></div>`;
    const label = row.querySelector("label");
    label.textContent = item.label;
    if (field === "max") label.insertAdjacentHTML("beforeend", "<small>au plus</small>");
    else if (kind === "incomes" && item.min !== item.max) label.insertAdjacentHTML("beforeend", "<small>au moins</small>");
    const input = row.querySelector("input");
    const written = (v) => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
    input.value = written(item[field]);
    input.addEventListener("change", () => {
      const value = window.entries.parseAmount(input.value);
      if (!(value >= 0)) {
        input.value = written(item[field]);
        window.toast("Un montant comme 12,50.", { tone: "error" });
        return;
      }
      item[field] = Math.round(value * 100) / 100;
      if (kind === "incomes" && item.min > item.max) item.max = item.min;
      savePlan();
      render();
      drawChart();
      window.toast(`${item.label} : ${fmt(item[field])}`);
    });
    return row;
  };

  const renderSettings = () => {
    const incomes = document.querySelector('[data-settings="incomes"]');
    if (incomes) {
      incomes.replaceChildren(...plan.incomes.flatMap((item) =>
        item.min === item.max && item.sure
          ? [settingRow(item, "incomes", "min")]
          : [settingRow(item, "incomes", "min"), settingRow(item, "incomes", "max")]
      ));
    }
    const charges = document.querySelector('[data-settings="charges"]');
    if (charges) charges.replaceChildren(...plan.charges.map((item) => settingRow(item, "charges", "amount")));

    // Affichage & Calcul - simples toggles pour l'instant
    const display = document.querySelector('[data-settings="display"]');
    if (display && !display.children.length) {
      display.innerHTML = `
        <div class="setting"><label class="setting__name">Thème d'affichage</label><div class="seg seg--choice" role="radiogroup" aria-label="Thème">
          <label><input type="radio" name="theme" value="auto" checked><span>Automatique (Système)</span></label>
          <label><input type="radio" name="theme" value="light"><span>Clair</span></label>
          <label><input type="radio" name="theme" value="dark"><span>Sombre</span></label>
        </div></div>`;
      const saved = localStorage.getItem("theme") || "auto";
      display.querySelector(`input[value="${saved}"]`).checked = true;
      display.addEventListener("change", (e) => {
        if (e.target.name === "theme") {
          localStorage.setItem("theme", e.target.value);
          applyTheme(e.target.value);
        }
      });
    }

    const calc = document.querySelector('[data-settings="calculation"]');
    if (calc && !calc.children.length) {
      calc.innerHTML = `
        <div class="setting"><label class="setting__name">Mode prudent</label><div class="seg seg--choice" role="radiogroup" aria-label="Mode prudent">
          <label><input type="radio" name="prudent" value="min" checked><span>CAF minimum uniquement (recommandé)</span></label>
          <label><input type="radio" name="prudent" value="max"><span>Inclure CAF max</span></label>
        </div></div>`;
    }
  };

  // Appliquer thème
  const applyTheme = (mode) => {
    if (mode === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", mode);
    }
  };

  // ---- GRAPHIQUE (Bilan) ----
  const chartEl = document.querySelector('[data-chart="budget"]');
  const drawChart = () => {
    if (!chartEl) return;
    const months = [];
    for (let back = 5; back >= 0; back -= 1) {
      const [year, month] = window.app.month.split("-").map(Number);
      const date = new Date(year, month - 1 - back, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    const sure = plan.incomes.filter(i => i.sure).reduce((sum, i) => sum + i.min, 0);
    const fixed = plan.charges.reduce((sum, c) => sum + c.amount, 0);
    const labelFmt = new Intl.DateTimeFormat("fr", { month: "short" });
    const sums = months.map((month) => {
      const own = window.entries.totals(window.entries.month(month));
      const planned = month >= plan.start;
      return { income: (planned ? sure : 0) + own.income, spending: (planned ? fixed : 0) + own.spending };
    });
    window.drawChart(chartEl, {
      labels: months.map(m => labelFmt.format(new Date(`${m}-01T12:00:00`)).replace(".", "")),
      series: [
        { name: "Rentrées", tone: "in", values: sums.map(s => s.income) },
        { name: "Dépenses", tone: "out", values: sums.map(s => s.spending) },
      ],
    });
  };

  // ---- INITIALISATION THÈME ----
  applyTheme(localStorage.getItem("theme") || "auto");

  // ---- ÉCOUTEURS ----
  document.addEventListener("entries:change", () => { render(); drawChart(); });
  document.addEventListener("monthchange", () => { render(); drawChart(); });
  document.addEventListener("screenchange", () => requestAnimationFrame(drawChart));

  // Initial render
  renderSettings();
  render();
  drawChart();
})();