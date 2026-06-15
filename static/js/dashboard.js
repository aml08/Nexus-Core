// Initialisation des tableaux de stockage pour l'historique du graphique en ligne
let labelsChronologiques = [];
let donneesCPU = [];
let donneesTemp = [];

// Déclarations des variables globales pour Chart.js
let lineChartInstance = null;
let radarChartInstance = null;

// Initialisation des graphiques au chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    rafraichirDashboard();
    // Lancement de la boucle de rafraîchissement toutes les 2 secondes
    setInterval(rafraichirDashboard, 2000);
});

// Fonction pour initialiser les objets graphiques Chart.js
function initCharts() {
    // 1. Graphique d'Évolution Temporelle (Line Chart)
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labelsChronologiques,
            datasets: [
                {
                    label: 'CPU Usage (%)',
                    data: donneesCPU,
                    borderColor: 'rgb(147, 51, 234)', // Violet
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Température (°C)',
                    data: donneesTemp,
                    borderColor: 'rgb(234, 179, 8)', // Jaune
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: '#1f2937' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            },
            plugins: { legend: { labels: { color: '#f3f4f6' } } }
        }
    });

    // 2. Graphique Probabilités Statuts (Radar Chart)
    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    radarChartInstance = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Optimal', 'Warning', 'Critical'],
            datasets: [{
                label: 'Vecteur d\'Analyse',
                data: [0, 0, 0], // Valeurs par défaut mises à jour dynamiquement
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgb(59, 130, 246)',
                pointBackgroundColor: 'rgb(59, 130, 246)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    grid: { color: '#374151' },
                    angleLines: { color: '#374151' },
                    ticks: { display: false },
                    pointLabels: { color: '#9ca3af', font: { size: 11 } }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Fonction maîtresse pour interroger l'API Flask et animer l'interface
function rafraichirDashboard() {
    fetch('/api/live-data')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const trame = data[0];
                
                // 1. Injection des valeurs dans les cartes KPIs
                document.getElementById('cpu-value').innerText = trame.cpu_usage_pct + ' %';
                document.getElementById('temp-value').innerText = trame.cpu_temperature_celsius + ' °C';
                document.getElementById('latency-value').innerText = trame.network_latency_ms + ' ms';
                
                // Gestion stylisée du bandeau de diagnostic IA
                const statutId = trame.system_status;
                const statutElement = document.getElementById('status-value');
                if (statutId === 0) {
                    statutElement.innerText = '🛡️ Optimal';
                    statutElement.className = "text-xl font-black text-green-400 mt-1";
                } else {
                    statutElement.innerText = '⚠️ Warning';
                    statutElement.className = "text-xl font-black text-yellow-500 mt-1";
                }

                // 2. Mise à jour de l'historique pour le graphique Temporel
                const heureFormat = new Date(trame.timestamp).toLocaleTimeString('fr-FR');
                labelsChronologiques.push(heureFormat);
                donneesCPU.push(trame.cpu_usage_pct);
                donneesTemp.push(trame.cpu_temperature_celsius);

                // Limitation du graphique à 10 points de données pour conserver la lisibilité
                if (labelsChronologiques.length > 10) {
                    labelsChronologiques.shift();
                    donneesCPU.shift();
                    donneesTemp.shift();
                }
                lineChartInstance.update();

                // 3. Simulation des probabilités pour le radar (généré à partir de l'état global)
                let probas = [0.90, 0.08, 0.02]; // Cas d'école
                if (statutId === 1) probas = [0.15, 0.75, 0.10];
                radarChartInstance.data.datasets[0].data = probas;
                radarChartInstance.update();

                // 4. Ajout d'une ligne dans le tableau d'historique (Page 3)
                const tableBody = document.getElementById('logsTableBody');
                const nouvelleLigne = document.createElement('div');
                nouvelleLigne.className = "flex w-full hover:bg-gray-900 border-b border-gray-800 transition-all p-4";
                nouvelleLigne.innerHTML = `
                    <div class="w-1/6 text-blue-400">${heureFormat}</div>
                    <div class="w-1/6">${trame.cpu_usage_pct} %</div>
                    <div class="w-1/6">${trame.ram_usage_pct} %</div>
                    <div class="w-1/6 text-yellow-500">${trame.cpu_temperature_celsius} °C</div>
                    <div class="w-1/6">${trame.disk_io_rate} mb/s</div>
                    <div class="w-1/6 text-green-400">${trame.network_latency_ms} ms</div>
                `;
                // Supprimer le message d'attente initial au premier passage
                if(tableBody.querySelector('p')) tableBody.innerHTML = '';
                tableBody.insertBefore(nouvelleLigne, tableBody.firstChild);
            }
        })
        .catch(err => console.error('Erreur traitement asynchrone:', err));
}

// Contrôleur de commutation d'onglets (Navigation multi-pages)
function switchTab(tabId) {
    // Masquer toutes les sections
    document.getElementById('page-dashboard').classList.add('hidden');
    document.getElementById('page-analytics').classList.add('hidden');
    document.getElementById('page-logs').classList.add('hidden');

    // Réinitialiser le style des boutons du menu de gauche
    document.getElementById('btn-dashboard').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";
    document.getElementById('btn-analytics').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";
    document.getElementById('btn-logs').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";

    // Afficher l'onglet actif et surligner son bouton de menu
    if (tabId === 'dashboard') {
        document.getElementById('page-dashboard').classList.remove('hidden');
        document.getElementById('btn-dashboard').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Tableau de Bord Télémétrie";
    } else if (tabId === 'analytics') {
        document.getElementById('page-analytics').classList.remove('hidden');
        document.getElementById('btn-analytics').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Spécifications & Architecture de l'IA";
    } else if (tabId === 'logs') {
        document.getElementById('page-logs').classList.remove('hidden');
        document.getElementById('btn-logs').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Registre Historique Base de Données";
    }
}
