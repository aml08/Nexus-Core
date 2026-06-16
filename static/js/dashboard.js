let labelsChronologiques = [];
let donneesCPU = [];
let donneesTemp = [];
let lineChartInstance = null;
let radarChartInstance = null;
let currentSite = 'RNT-PRD-01';
let historiqueCompletTableau = [];

let clignotementVerrouille = false;
let configurationsClignotementActuelles = { cpu: false, temp: false };

document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    rafraichirDashboard();
    setInterval(rafraichirDashboard, 5000);
    simulerScenario(); // Initie le simulateur au chargement
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
    document.getElementById('predictive-alert-box').classList.add('hidden');
    clignotementVerrouille = false;
    stopperTousLesClignotements();
    rafraichirDashboard();
}

function stopperTousLesClignotements() {
    const cpuCard = document.getElementById('cpu-value').closest('.bg-gray-900');
    const tempCard = document.getElementById('temp-value').closest('.bg-gray-900');
    cpuCard.className = "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex items-center justify-between transition-all duration-500";
    tempCard.className = "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex items-center justify-between transition-all duration-500";
    configurationsClignotementActuelles = { cpu: false, temp: false };
}

function appliquerStyleClignotement(elementId, activer) {
    const card = document.getElementById(elementId).closest('.bg-gray-900');
    if (activer) {
        card.className = "bg-red-950/80 border border-red-700 rounded-xl p-6 shadow-xl flex items-center justify-between animate-pulse transition-all duration-500";
    } else {
        card.className = "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex items-center justify-between transition-all duration-500";
    }
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
                    
                    let applicationCritiqueActive = false;

                    if (predResult.status === 'success') {
                        const pred = predResult.prediction;
                        
                        if (pred === 0) {
                            statutElement.innerText = '🛡️ Nominal';
                            statutElement.className = "text-xl font-black text-green-400 mt-1";
                            alertBox.classList.add('hidden');
                            if (!clignotementVerrouille) stopperTousLesClignotements();
                        } else if (pred === 1) {
                            statutElement.innerText = '⚠️ Alerte';
                            statutElement.className = "text-xl font-black text-yellow-500 mt-1";
                            alertBox.classList.add('hidden');
                            if (!clignotementVerrouille) stopperTousLesClignotements();
                        } else {
                            applicationCritiqueActive = true;
                            statutElement.innerText = '🚨 Critique';
                            statutElement.className = "text-xl font-black text-red-500 mt-1";
                            
                            let causes = [];
                            let declencherClignotementCPU = false;
                            let declencherClignotementTemp = false;

                            if (trame.cpu_usage_pct > 70) {
                                causes.push(`Surcharge CPU de ${trame.cpu_usage_pct}% (Seuil max conseillé: 70%)`);
                                declencherClignotementCPU = true;
                            }
                            if (trame.ram_usage_pct > 70) {
                                causes.push(`Saturation de la mémoire RAM à ${trame.ram_usage_pct}%`);
                            }
                            if (trame.cpu_temperature_celsius > 75) {
                                causes.push(`Surchauffe thermique détectée au cœur des processeurs (${trame.cpu_temperature_celsius}°C)`);
                                declencherClignotementTemp = true;
                            }
                            if (causes.length === 0) {
                                causes.push("Anomalie système globale non linéaire identifiée");
                            }

                            alertText.innerHTML = `L'analyse prédictive a détecté des anomalies majeures sur le site <b>${currentSite}</b> :<br>• ${causes.join('<br>• ')}.<br><span class="text-red-400 font-bold">Intervention recommandée sous un délai estimé de 3 heures.</span>`;
                            alertBox.classList.remove('hidden');

                            if (!clignotementVerrouille) {
                                clignotementVerrouille = true;
                                configurationsClignotementActuelles.cpu = declencherClignotementCPU;
                                configurationsClignotementActuelles.temp = declencherClignotementTemp;

                                if (configurationsClignotementActuelles.cpu) appliquerStyleClignotement('cpu-value', true);
                                if (configurationsClignotementActuelles.temp) appliquerStyleClignotement('temp-value', true);

                                setTimeout(() => { clignotementVerrouille = false; }, 10000);
                            }
                        }

                        if (clignotementVerrouille) {
                            if (configurationsClignotementActuelles.cpu) appliquerStyleClignotement('cpu-value', true);
                            if (configurationsClignotementActuelles.temp) appliquerStyleClignotement('temp-value', true);
                        }

                        // Mettre à jour le planning et l'indice d'usure de la page 2
                        actualiserPlanningMaintenance(applicationCritiqueActive, trame.cpu_temperature_celsius);

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

// Génération intelligente du planning de la page 2
function actualiserPlanningMaintenance(isDakarCritique, currentTemp) {
    const planningBody = document.getElementById('planningTableBody');
    
    // Calcul factice mais cohérent de l'indice visuel d'usure basé sur la température
    const usureCalculee = (currentTemp > 70) ? (currentTemp * 0.4).toFixed(1) : (currentTemp * 0.2).toFixed(1);
    document.getElementById('kpi-usure').innerText = usureCalculee + ' %';

    let dakarRow = `
        <tr class="border-b border-gray-800 hover:bg-gray-950">
            <td class="p-3 font-mono text-xs text-gray-500">WO-2026-003</td>
            <td class="p-3 font-bold text-xs">RNT-DKR-03 (Dakar)</td>
            <td class="p-3 text-xs text-gray-400">Contrôle de routine des infrastructures de climatisation</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">BASSE</span></td>
            <td class="p-3"><span class="text-xs text-gray-400"><i class="fa-regular fa-clock mr-1"></i>À Planifier</span></td>
        </tr>`;

    if (isDakarCritique && currentSite === 'RNT-DKR-03') {
        dakarRow = `
        <tr class="border-b border-red-950 bg-red-950/20 hover:bg-red-950/30 animate-pulse">
            <td class="p-3 font-mono text-xs text-red-400 font-bold">WO-2026-ALERT</td>
            <td class="p-3 font-bold text-xs text-red-200">RNT-DKR-03 (Dakar)</td>
            <td class="p-3 text-xs text-red-300 font-semibold">URGENT : Remplacement immédiat du ventilateur & purge thermique</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">CRITIQUE</span></td>
            <td class="p-3"><span class="text-xs text-red-400 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Équipe dépêchée</span></td>
        </tr>`;
    }

    planningBody.innerHTML = `
        <tr class="border-b border-gray-800 hover:bg-gray-950">
            <td class="p-3 font-mono text-xs text-gray-500">WO-2026-001</td>
            <td class="p-3 font-bold text-xs">RNT-PRD-01 (Paris)</td>
            <td class="p-3 text-xs text-gray-400">Nettoyage de poussière sur les racks d'alimentation secteur</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-900/40 text-green-400">FAIBLE</span></td>
            <td class="p-3"><span class="text-xs text-green-400"><i class="fa-solid fa-check mr-1"></i>Terminé</span></td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-gray-950">
            <td class="p-3 font-mono text-xs text-gray-500">WO-2026-002</td>
            <td class="p-3 font-bold text-xs">RNT-BRX-02 (Bordeaux)</td>
            <td class="p-3 text-xs text-gray-400">Mise à jour des firmwares des commutateurs réseaux secondaires</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-900/40 text-yellow-500">MOYENNE</span></td>
            <td class="p-3"><span class="text-xs text-yellow-500"><i class="fa-solid fa-spinner fa-spin mr-1"></i>En Cours</span></td>
        </tr>
        ${dakarRow}
    `;
}

// Logique mathématique locale pour simuler les scénarios (Stress-Test)
function simulerScenario() {
    const cpu = parseInt(document.getElementById('sim-cpu').value);
    const temp = parseInt(document.getElementById('sim-temp').value);
    const lat = parseInt(document.getElementById('sim-lat').value);

    document.getElementById('val-sim-cpu').innerText = cpu + ' %';
    document.getElementById('val-sim-temp').innerText = temp + ' °C';
    document.getElementById('val-sim-lat').innerText = lat + ' ms';

    const card = document.getElementById('sim-response-card');
    const icon = document.getElementById('sim-icon');
    const status = document.getElementById('sim-status');
    const text = document.getElementById('sim-text');

    // Émulation des règles de décision de l'arbre de décision/Random Forest
    if (cpu >= 80 || temp >= 76) {
        card.className = "bg-red-950/40 p-6 rounded-xl border border-red-900 flex flex-col justify-center items-center text-center transition-all duration-300";
        icon.className = "p-4 bg-red-900 text-red-200 rounded-full mb-3";
        icon.innerHTML = `<i class="fa-solid fa-skull-crossbones text-3xl"></i>`;
        status.innerText = "État de Résilience : Critique (Panne)";
        status.className = "text-lg font-black text-red-400 uppercase";
        text.innerText = `L'algorithme prédit une rupture imminente matérielle. Profil thermique/charge insoutenable à long terme.`;
    } else if (cpu > 65 || temp > 68 || lat > 60) {
        card.className = "bg-yellow-950/40 p-6 rounded-xl border border-yellow-900 flex flex-col justify-center items-center text-center transition-all duration-300";
        icon.className = "p-4 bg-yellow-900 text-yellow-200 rounded-full mb-3";
        icon.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-3xl"></i>`;
        status.innerText = "État de Résilience : Alerte Dégradée";
        status.className = "text-lg font-black text-yellow-500 uppercase";
        text.innerText = `Le système entre en zone de sur-sollicitation. Vigilance requise, performances ralenties.`;
    } else {
        card.className = "bg-gray-950 p-6 rounded-xl border border-gray-800 flex flex-col justify-center items-center text-center transition-all duration-300";
        icon.className = "p-4 bg-green-950/50 text-green-400 rounded-full mb-3";
        icon.innerHTML = `<i class="fa-solid fa-shield-halved text-3xl"></i>`;
        status.innerText = "État de Résilience : Nominal";
        status.className = "text-lg font-black text-green-400 uppercase";
        text.innerText = `Le profil de charge simulé respecte parfaitement les marges opérationnelles du système. Risque de panne nul.`;
    }
}

function exportToCSV() {
    if (historiqueCompletTableau.length === 0) {
        alert("Aucune donnée disponible pour l'export.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Horodatage,Site,CPU (%),RAM (%),Temperature (C),Latence (ms)\n";
    historiqueCompletTableau.forEach(row => {
        csvContent += `${row.horodatage},${row.site},${row.cpu},${row.ram},${row.temp},${row.latence}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus_historique_${currentSite}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToPDF() {
    if (historiqueCompletTableau.length === 0) {
        alert("Aucune donnée disponible pour l'export.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.text(`REGISTRE HISTORIQUE DES DONNÉES - SITE ${currentSite}`, 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Rapport généré le : ${new Date().toLocaleString('fr-FR')}`, 14, 22);

    const tableRows = [];
    historiqueCompletTableau.forEach(row => {
        tableRows.push([row.horodatage, row.site, row.cpu + ' %', row.ram + ' %', row.temp + ' °C', row.latence + ' ms']);
    });

    doc.autoTable({
        head: [['Horodatage', 'Code Site', 'CPU', 'RAM', 'Température', 'Latence']],
        body: tableRows,
        startY: 28,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`rapport_telemetrie_${currentSite}.pdf`);
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
        document.getElementById('page-title').innerText = "Gestion & Planification Prédictive";
    } else if (tabId === 'logs') {
        document.getElementById('page-logs').classList.remove('hidden');
        document.getElementById('btn-logs').className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        document.getElementById('page-title').innerText = "Historique des Données";
    }
}
