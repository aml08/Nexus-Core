# Nexus Core - Système Prédictif de Maintenance d'Infrastructures Cloud

## Description du Projet

Nexus Core est une plateforme logicielle et analytique d'IA industrialisée conçue pour anticiper les défaillances matérielles et logicielles des infrastructures serveurs distribuées du Groupe Renault (sites de Paris, Bordeaux et Dakar).

Face aux limites des outils de supervision traditionnels basés sur des seuils statiques réactifs, Nexus Core exploite un moteur d'apprentissage supervisé **Random Forest (Forêt Aléatoire)** capable d'analyser en temps réel les flux de télémétrie multi-variés (charge CPU, taux d'occupation RAM, fatigue thermique processeur, débit disque et latence réseau). La solution prédit les niveaux de risque d'avarie (Nominal, Vigilance, Critique) avant la survenue d'arrêts de production non planifiés, tout en s'inscrivant dans une démarche de Green Computing par le suivi du PUE (Power Usage Effectiveness = 1.21) et de l'usure matérielle.

Projet développé dans le cadre de la thèse professionnelle du Master 2 Chef de Projet IA et Data (Nexa Digital School, Promotion 2025/2026).

---

## Architecture de la Solution

L'application s'articule autour d'un pipeline complet d'ingénierie des données et d'apprentissage automatique :

1. **Ingestion et Stockage :** Centralisation des métriques IoT et des journaux d'événements au sein d'un SGBDR PostgreSQL hébergé sur Render Cloud. Optimisation des temps de requête de 142 ms à 8 ms (-94%) par indexation B-Tree composite sur les variables d'horodatage et d'identification des sites (`server_id, timestamp`).
2. **Moteur Prédictif :** Modèle de classification **Random Forest** entraîné sur un historique stratifié (80% entraînement / 20% test). Sérialisation binaire de l'artefact prédictif via Joblib pour assurer une inférence en quelques millisecondes.
3. **Back-End Applicatif :** API REST légère développée sous le framework Python Flask (`app.py`), assurant le contrôle des sessions applicatives et la distribution asynchrone des prédictions.
4. **Front-End de Supervision :** Interface web dynamique Single Page Application (SPA) en HTML5, JavaScript asynchrone (Fetch API) et TailwindCSS. Intègre un badge de statut réactif, un module de simulation de charge, un registre d'historisation exportable en CSV et PDF, ainsi qu'un tableau de bord de planification d'intervention.

---

## Technologies Utilisées

- **Langage principal :** Python 3.10+
- **Modélisation & Data Science :** Random Forest, Scikit-Learn, XGBoost, Pandas, NumPy, Joblib, SHAP
- **Base de Données :** PostgreSQL, Psycopg2 (Indexation B-Tree)
- **Framework Applicatif Back-End :** Flask
- **Interface Graphique Front-End :** HTML5, JavaScript (ES6+), TailwindCSS
- **Hébergement Cloud & Déploiement :** Render Cloud Platform
- **Outils de Planification & Suivi :** Git, GitHub, Trello (Scrum/Kanban)

---

## Performances des Modèles (Benchmark)

Les résultats comparatifs obtenus lors des phases de validation sur le jeu de test stratifié (5 185 instances) sont les suivants :

- **Random Forest Classifier (Modèle Retenu en Production) :** Accuracy globale de **99.59%**, Précision de **91.94%** sur les alertes de vigilance, et **Rappel parfait de 100.00% sur les pannes critiques** (0 faux négatif). Stabilité confirmée en Cross-Validation (CV Mean: 99.55% ±0.0004).
- **XGBoost Classifier :** Accuracy globale de 99.50%, Précision de 88.89% sur la vigilance et Rappel de 92.86% sur la classe critique.
- **Régression Logistique :** Accuracy globale de 92.44%, mais effondrement de la précision à 14.35% sur la classe de vigilance et incertitude sur les crises en raison de la non-linéarité des signaux physiques.

---

## Sécurité, Conformité et Accessibilité

- **Protection des Données (RGPD) :** Intégration d'un filtre d'anonymisation préventif (`nettoyagergpd.py`) identifiant et chiffrant toute trace sensible ou adresse IP par expressions régulières avant insertion en base.
- **Traçabilité et Cybersécurité (Directive NIS 2) :** Gestion hermétique des accès avec compte applicatif dédié aux droits restreints (`nexus_app_user`), connexions chiffrées en TLS 1.3, et isolation des secrets de production via des variables d'environnement chiffrées (`DATABASE_URL`, `FLASK_SECRET_KEY`).
- **Accessibilité (RGAA / WCAG 2.1) :** Prise en charge des lecteurs d'écran par attributs ARIA dynamiques (`aria-live="assertive"`), navigation intégrale au clavier via l'ordonnancement du focus, et respect d'un ratio de contraste visuel supérieur à 4.5:1 sur thème sombre.

---

## Structure du Dépôt
NEXUS-CORE/
├── data/
│   ├── system_logs.json
│   └── telemetry_metrics.csv
├── models/
│   ├── random_forest_model.pkl
│   ├── xgboost_model.pkl
│   ├── logistic_regression_model.pkl
│   └── models_comparison.json
├── static/
│   ├── js/
│   │   ├── dashboard.js
│   │   └── export_reports.js
│   └── css/
├── templates/
│   ├── index.html
│   └── login.html
├── app.py
├── train_models.py
├── schema.sql
├── nettoyagergpd.py
├── requirements.txt
└── README.md

---

## Guide d'Installation et Déploiement Local

### 1. Prérequis
- Python 3.10 ou supérieur installé.
- Une instance PostgreSQL fonctionnelle.
- Git installé.

### 2. Cloner le Dépôt
```bash
git clone [https://github.com/aml08/nexus-core.git](https://github.com/aml08/nexus-core.git)
cd nexus-core
```

### 3. Création et Activation de l'Environnement Virtuel
Sous Linux / macOS :

```bash
python3 -m venv venv
source venv/bin/activate
```

Sous Windows (PowerShell) :
```powersell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 4. Installation des Dépendances

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Configuration de la Base de Données
Exécutez le script SQL schema.sql sur votre instance PostgreSQL pour instancier les tables server_metrics, server_logs et l'index B-Tree composite.

Configurez les variables d'environnement système :
```bash
export DATABASE_URL="postgresql://utilisateur:motdepasse@localhost:5432/nom_de_base"
export FLASK_SECRET_KEY="CleSecuriseeNexus2026"
```

### 6. Lancement de l'Application Web
```bash
python app.py
```

L'application sera accessible sur : http://127.0.0.1:5000

Identifiants de Test et Accès Démo
URL de Production Hébergée : https://nexus-core.onrender.com

Licence et Droits d'Auteur
Ce projet est développé dans le cadre académique de la thèse professionnelle de Master 2 Data & IA pour Nexa Digital School et le Groupe Renault. Tous droits réservés - 2026.
