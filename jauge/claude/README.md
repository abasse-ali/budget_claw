# 💸 Mon Budget

Appli web perso pour gérer mon budget mensuel, pensée pour le téléphone (installable sur l’écran d’accueil, fonctionne hors-ligne).

## Fonctionnalités

- **Accueil** : « disponible à dépenser » (calcul prudent), budget par jour jusqu’à la fin du mois, meilleur des cas, alerte si je dépense trop vite.
- **Rentrées & charges fixes** à cocher chaque mois (montant réel demandé pour la CAF et les espèces).
  - `+` gain sûr, `~` gain non assuré (les espèces ne comptent qu’une fois reçues), `−` perte.
- **Opérations** : dépenses par catégorie, rentrées en plus, épargne — ajout rapide avec le bouton ＋.
- **Budgets par catégorie** avec barres de progression.
- **Objectifs d’épargne** (fonds de secours, etc.) + épargne mensuelle réservée avant les dépenses.
- **Bilan** : reste mensuel (prudent / habituel / optimiste), simulateur CAF/espèces, graphique 6 mois, répartition des dépenses.
- **Réglages** : modifier les montants récurrents, catégories, thème clair/sombre, export / import de sauvegarde.

Les données restent **uniquement sur le téléphone** (localStorage). Pense à exporter une sauvegarde de temps en temps.

## L’utiliser sur le téléphone

1. Sur GitHub : **Settings → Pages → Source : GitHub Actions**.
2. Le workflow `.github/workflows/pages.yml` publie l’appli à chaque push sur la branche par défaut.
3. Ouvre l’adresse `https://<utilisateur>.github.io/budget_claude/` sur le téléphone puis :
   - iPhone (Safari) : Partager → **Sur l’écran d’accueil**
   - Android (Chrome) : ⋮ → **Installer l’application**

## En local

```sh
python3 -m http.server 8000
# puis http://localhost:8000
```

Aucune dépendance, aucun build : `index.html`, `styles.css`, `app.js`.
