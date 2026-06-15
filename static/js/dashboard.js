let labelsChronologiques = [];
let donneesCPU = [];
let donneesTemp = [];
let lineChartInstance = null;
let radarChartInstance = null;
let currentModelKey = 'random_forest';

document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    rafraichirDashboard();
    loadModelComparison();
    setInterval(rafraichirDashboard, 2000);
});

function initCharts() {
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labelsChronologiques,
            datasets: [
                {
                    label: 'CPU Usage (%)',
                    data: donneesCPU,
                    borderColor: 'rgb(147, 51, 234)',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Température (°C)',
                    data: donneesTemp,
                    borderColor: 'rgb(234, 179, 8)',
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

    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    radarChartInstance = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Optimal', 'Warning', 'Critical'],
            datasets: [{
                label: 'Vecteur d\'Analyse',
                data: [0, 0, 0],
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

function changeActiveModel(modelKey) {
    currentModelKey = modelKey;
    console.log("Modèle actif changé pour : " + modelKey);
}

function rafraichirDashboard() {
    fetch('/api/live-data')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const trame = data[0];
                
                document.getElementById('cpu-value').innerText = trame.cpu_usage_pct + ' %';
                document.getElementById('temp-value').innerText = trame.cpu_temperature_celsius + ' °C';
                document.getElementById('latency-value').innerText = trame.network_latency_ms + ' ms';

                // Envoi des données au modèle sélectionné pour prédiction
                fetch('/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model_key: currentModelKey,
                        cpu_usage_pct: trame.cpu_usage_pct,
                        ram_usage_pct: trame.ram_usage_pct,
                        cpu_temperature_celsius: trame.cpu_temperature_celsius,
                        disk_io_rate: trame.disk_io_rate,
                        network_latency_ms: trame.network_latency_ms
                    })
                })
                .then(res => res.json())
                .then(predResult => {
                    const statutElement = document.getElementById('status-value');
                    if (predResult.status === 'success') {
                        const pred = predResult.prediction;
                        if (pred === 0) {
                            statutElement.innerText = '🛡️ Optimal';
                            statutElement.className = "text-xl font-black text-green-400 mt-1";
                        } else if (pred === 1) {
                            statutElement.innerText = '⚠️ Warning';
                            statutElement.className = "text-xl font-black text-yellow-500 mt-1";
                        } else {
                            statutElement.innerText = '🚨 Critical';
                            statutElement.className = "text-xl font-black text-red-500 mt-1";
                        }

                        radarChartInstance.data.datasets[0].data = [
                            predResult.probabilities.optimal,
                            predResult.probabilities.warning,
                            predResult.probabilities.critical
                        ];
                        radarChartInstance.update();
                    }
                });

                const heureFormat = new Date(trame.timestamp).toLocaleTimeString('fr-FR');
                labelsChronologiques.push(heureFormat);
                donneesCPU.push(trame.cpu_usage_pct);
                donneesTemp.push(trame.cpu_temperature_celsius);

                if (labelsChronologiques.length > 10) {
                    labelsChronologiques.shift();
                    donneesCPU.shift();
                    donneesTemp.shift();
                }
                lineChartInstance.update();

                const tableBody = document.getElementById('logsTableBody');
                const nouvelleLigne = document.createElement('tr');
                nouvelleLigne.className = "hover:bg-gray-900 transition-all";
                nouvelleLigne.innerHTML = `
                    <td class="p-4 text-blue-400">${heureFormat}</td>
                    <td class="p-4">${trame.cpu_usage_pct} %</td>
                    <td class="p-4">${trame.ram_usage_pct} %</td>
                    <td class="p-4 text-yellow-500">${trame.cpu_temperature_celsius} °C</td>
                    <td class="p-4">${trame.disk_io_rate} mb/s</td>
                    <td class="p-4 text-green-400">${trame.network_latency_ms} ms</td>
                `;
                tableBody.insertBefore(nouvelleLigne, tableBody.firstChild);
                if (tableBody.children.length > 15) {
                    tableBody.removeChild(tableBody.lastChild);
                }
            }
        })
        .catch(err => console.error('Erreur:', err));
}

function loadModelComparison() {
    fetch('/api/model-comparison')
        .then(response => response.json())
        .then(data => {
            const cardsContainer = document.getElementById('comparison-cards');
            const detailsContainer = document.getElementById('detailed-metrics');
            cardsContainer.innerHTML = '';
            detailsContainer.innerHTML = '';

            for (const [modelName, metrics] of Object.entries(data)) {
                // Injection des cartes globales
                const card = document.createElement('div');
                card.className = "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl text-center";
                card.innerHTML = `
                    <span class="text-xs text-gray-400 uppercase font-bold tracking-wider">${modelName.replace('_', ' ')}</span>
                    <p class="text-3xl font-extrabold text-blue-400 mt-2">${metrics.accuracy} %</p>
                    <span class="text-xs text-gray-500 block mt-1">Précision globale</span>
                `;
                cardsContainer.appendChild(card);

                // Injection des rapports détaillés par classe
                const detailSection = document.createElement('div');
                detailSection.className = "bg-gray-950 p-4 rounded-lg border border-gray-800 font-mono text-xs text-gray-400 overflow-x-auto";
                detailSection.innerHTML = `
                    <h4 class="text-white font-bold mb-2 uppercase text-sm">${modelName.replace('_', ' ')}</h4>
                    <p>Classe 0 (Optimal)  -> Precision: ${roundMetric(metrics.report['0'].precision)}, Recall: ${roundMetric(metrics.report['0'].recall)}, F1-Score: ${roundMetric(metrics.report['0'].f1-score)}</p>
                    <p>Classe 1 (Warning)  -> Precision: ${roundMetric(metrics.report['1'].precision)}, Recall: ${roundMetric(metrics.report['1'].recall)}, F1-Score: ${roundMetric(metrics.report['1'].f1-score)}</p>
                    <p>Classe 2 (Critical) -> Precision: ${roundMetric(metrics.report['2'].precision)}, Recall: ${roundMetric(metrics.report['2'].recall)}, F1-Score: ${roundMetric(metrics.report['2'].f1-score)}</p>
                `;
                detailsContainer.appendChild(detailSection);
            }
        })
        .catch(err => console.error('Erreur chargement métriques:', err));
}

function roundMetric(val) {
    return (val * 100).toFixed(2) + '%';
}

function switchTab(tabId) {
    document.getElementById('page-dashboard').classList.add('hidden');
    document.getElementById('page-analytics').classList.add('hidden');
    document.getElementById('page-logs').classList.add('hidden');

    document.getElementById('btn-dashboard').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";
    document.getElementById('btn-analytics').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";
    document.getElementById('btn-logs').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";

    if (tabId === 'dashboard') {
        document.getElementById('page-dashboard').classList.remove('hidden');
        document.getElementById('btn-dashboard').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Tableau de Bord Télémétrie";
    } else if (tabId === 'analytics') {
        document.getElementById('page-analytics').classList.remove('hidden');
        document.getElementById('btn-analytics').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Comparateur de Modèles Algorithmiques";
    } else if (tabId === 'logs') {
        document.getElementById('page-logs').classList.remove('hidden');
        document.getElementById('btn-logs').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Registre Historique Base de Données";
    }
}
