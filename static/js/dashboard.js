let labelsChronologiques = [];
let donneesCPU = [];
let donneesTemp = [];
let lineChartInstance = null;
let radarChartInstance = null;
let currentSite = 'RNT-PRD-01';
let historiqueCompletTableau = []; // Stockage permanent pour l'exportation

document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    rafraichirDashboard();
    loadModelComparison();
    setInterval(rafraichirDashboard, 5000); // Frequence de rafraichissement baissee a 5 secondes
});

function initCharts() {
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labelsChronologiques,
            datasets: [
                { label: 'CPU (%)', data: donneesCPU, borderColor: 'rgb(147, 51, 234)', backgroundColor: 'rgba(147, 51, 234, 0.1)', tension: 0.3, fill: true },
                { label: 'Température (°C)', data: donneesTemp, borderColor: 'rgb(234, 179, 8)', backgroundColor: 'rgba(234, 179, 8, 0.1)', tension: 0.3, fill: true }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 400 } }
    });

    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    radarChartInstance = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Nominal', 'Alerte', 'Critique'],
            datasets: [{ label: 'Statut Probable', data: [0, 0, 0], backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgb(59, 130, 246)' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function changeActiveSite(siteKey) {
    currentSite = siteKey;
    labelsChronologiques = [];
    donneesCPU = [];
    donneesTemp = [];
    document.getElementById('logsTableBody').innerHTML = '';
    rafraichirDashboard();
}

function rafraichirDashboard() {
    fetch(`/api/live-data?site=${currentSite}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const trame = data[0];
                
                document.getElementById('cpu-value').innerText = trame.cpu_usage_pct + ' %';
                document.getElementById('temp-value').innerText = trame.cpu_temperature_celsius + ' °C';
                document.getElementById('latency-value').innerText = trame.network_latency_ms + ' ms';

                fetch('/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model_key: 'random_forest',
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
                    const alertBox = document.getElementById('predictive-alert-box');
                    const alertText = document.getElementById('predictive-alert-text');
                    
                    if (predResult.status === 'success') {
                        const pred = predResult.prediction;
                        
                        if (pred === 0) {
                            statutElement.innerText = '🛡️ Nominal';
                            statutElement.className = "text-xl font-black text-green-400 mt-1";
                            alertBox.classList.add('hidden');
                        } else if (pred === 1) {
                            statutElement.innerText = '⚠️ Alerte';
                            statutElement.className = "text-xl font-black text-yellow-500 mt-1";
                            alertBox.classList.add('hidden');
                        } else {
                            statutElement.innerText = '🚨 Critique';
                            statutElement.className = "text-xl font-black text-red-500 mt-1";
                            alertText.innerText = `Anomalie lourde detectee sur le site ${currentSite}. Risque d'interruption materielle estime sous un delai de 3 heures.`;
                            alertBox.classList.remove('hidden');
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

                // Ajout de la trame dans notre registre de sauvegarde permanent pour export
                historiqueCompletTableau.unshift({
                    horodatage: heureFormat,
                    site: trame.server_id,
                    cpu: trame.cpu_usage_pct,
                    ram: trame.ram_usage_pct,
                    temp: trame.cpu_temperature_celsius,
                    latence: trame.network_latency_ms
                });

                const tableBody = document.getElementById('logsTableBody');
                const nouvelleLigne = document.createElement('tr');
                nouvelleLigne.className = "hover:bg-gray-900 border-b border-gray-800 transition-all";
                nouvelleLigne.innerHTML = `
                    <td class="p-4 text-blue-400">${heureFormat}</td>
                    <td class="p-4 text-xs font-bold text-gray-400">${trame.server_id}</td>
                    <td class="p-4">${trame.cpu_usage_pct} %</td>
                    <td class="p-4">${trame.ram_usage_pct} %</td>
                    <td class="p-4 text-yellow-500">${trame.cpu_temperature_celsius} °C</td>
                    <td class="p-4 text-green-400">${trame.network_latency_ms} ms</td>
                `;
                tableBody.insertBefore(nouvelleLigne, tableBody.firstChild);
                if (tableBody.children.length > 50) tableBody.removeChild(tableBody.lastChild);
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

            // Lecture correcte des cles du dictionnaire JSON
            for (const [modelName, metrics] of Object.entries(data)) {
                const cleanName = modelName.replace('_', ' ');
                
                const card = document.createElement('div');
                card.className = "bg-gray-950 border border-gray-800 rounded-xl p-6 text-center shadow-inner";
                card.innerHTML = `
                    <span class="text-xs text-gray-400 uppercase font-bold tracking-wider">${cleanName}</span>
                    <p class="text-3xl font-black text-blue-500 mt-2">${metrics.accuracy} %</p>
                    <span class="text-xs text-gray-500 block mt-1">Taux de precision global</span>
                `;
                cardsContainer.appendChild(card);

                const detailSection = document.createElement('div');
                detailSection.className = "bg-gray-950 p-4 rounded-lg border border-gray-800 font-mono text-xs text-gray-400 space-y-1";
                
                // Extraction securisee des sous-metriques du rapport de classification
                const prec0 = (metrics.report['0'].precision * 100).toFixed(1) + '%';
                const rec0 = (metrics.report['0'].recall * 100).toFixed(1) + '%';
                const prec2 = (metrics.report['2'] ? (metrics.report['2'].precision * 100).toFixed(1) + '%' : 'N/A');
                const rec2 = (metrics.report['2'] ? (metrics.report['2'].recall * 100).toFixed(1) + '%' : 'N/A');

                detailSection.innerHTML = `
                    <h4 class="text-white font-bold mb-2 uppercase text-sm">${cleanName}</h4>
                    <p class="text-gray-300">-> Classe Statut Optimal  | Precision: ${prec0} | Rappel (Recall): ${rec0}</p>
                    <p class="text-red-400">-> Classe Statut Critique | Precision: ${prec2} | Rappel (Recall): ${rec2}</p>
                `;
                detailsContainer.appendChild(detailSection);
            }
        })
        .catch(err => console.log('Flux en cours de synchronisation...'));
}

// Fonction d'exportation au format CSV
function exportToCSV() {
    if (historiqueCompletTableau.length === 0) {
        alert("Aucune donnee disponible pour le moment.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Horodatage,Site,CPU (%),RAM (%),Temperature (C),Latence (ms)\n";
    historiqueCompletTableau.forEach(row => {
        csvContent += `${row.horodatage},${row.site},${row.cpu},${row.ram},${row.temp},${row.latence}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus_registre_${currentSite}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Fonction d'exportation au format PDF
function exportToPDF() {
    if (historiqueCompletTableau.length === 0) {
        alert("Aucune donnee disponible pour le moment.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.text(`RAPPORT DE REGISTRE DES DONNEES - SITE ${currentSite}`, 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Genere le : ${new Date().toLocaleString('fr-FR')}`, 14, 22);

    const tableRows = [];
    historiqueCompletTableau.forEach(row => {
        tableRows.push([row.horodatage, row.site, row.cpu + ' %', row.ram + ' %', row.temp + ' °C', row.latence + ' ms']);
    });

    doc.autoTable({
        head: [['Horodatage', 'Site', 'CPU', 'RAM', 'Temperature', 'Latence']],
        body: tableRows,
        startY: 28,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`rapport_nexus_${currentSite}.pdf`);
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
        document.getElementById('page-title').innerText = "Supervision Multi-Sites";
    } else if (tabId === 'analytics') {
        document.getElementById('page-analytics').classList.remove('hidden');
        document.getElementById('btn-analytics').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Rapport d'Audit Technique";
    } else if (tabId === 'logs') {
        document.getElementById('page-logs').classList.remove('hidden');
        document.getElementById('btn-logs').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Historique des Données";
    }
}
