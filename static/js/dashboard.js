let labelsChronologiques = [];
let donneesCPU = [];
let donneesTemp = [];
let lineChartInstance = null;
let radarChartInstance = null;
let currentSite = 'RNT-PRD-01';
let historiqueCompletTableau = [];

let modeCriseActif = false;
let configurationsClignotementActuelles = { cpu: false, temp: false };

document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    rafraichirDashboard();
    setInterval(rafraichirDashboard, 5000); 
    simulerScenario();
});

function initCharts() {
    const elLine = document.getElementById('lineChart');
    if (elLine) {
        const ctxLine = elLine.getContext('2d');
        lineChartInstance = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labelsChronologiques,
                datasets: [
                    { label: 'Charge CPU (%)', borderColor: 'rgb(147, 51, 234)', data: donneesCPU, backgroundColor: 'rgba(147, 51, 234, 0.1)', tension: 0.3, fill: true },
                    { label: 'Température (°C)', borderColor: 'rgb(234, 179, 8)', data: donneesTemp, backgroundColor: 'rgba(234, 179, 8, 0.1)', tension: 0.3, fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const elRadar = document.getElementById('radarChart');
    if (elRadar) {
        const ctxRadar = elRadar.getContext('2d');
        radarChartInstance = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['Nominal', 'Alerte', 'Critique'],
                datasets: [{ label: 'Niveau de Risque', data: [0, 0, 0], backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgb(59, 130, 246)' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function changeActiveSite(siteKey) {
    currentSite = siteKey;
    labelsChronologiques = [];
    donneesCPU = [];
    donneesTemp = [];
    
    const logsBody = document.getElementById('logsTableBody');
    if (logsBody) logsBody.innerHTML = '';
    
    const alertBox = document.getElementById('predictive-alert-box');
    if (alertBox) alertBox.classList.add('hidden');
    
    modeCriseActif = false;
    stopperTousLesClignotements();
    rafraichirDashboard();
}

function stopperTousLesClignotements() {
    const cpuEl = document.getElementById('cpu-value');
    const tempEl = document.getElementById('temp-value');
    
    if (cpuEl && cpuEl.closest('.bg-gray-900')) {
        cpuEl.closest('.bg-gray-900').className = "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex items-center justify-between transition-all duration-500";
    }
    if (tempEl && tempEl.closest('.bg-gray-900')) {
        tempEl.closest('.bg-gray-900').className = "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex items-center justify-between transition-all duration-500";
    }
    configurationsClignotementActuelles = { cpu: false, temp: false };
}

function appliquerStyleClignotement(elementId, activer) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const card = el.closest('.bg-gray-900');
    if (!card) return;
    
    if (activer) {
        card.className = "bg-red-950/80 border border-red-700 rounded-xl p-6 shadow-xl flex items-center justify-between animate-pulse transition-all duration-500";
    } else {
        card.className = "bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl flex items-center justify-between transition-all duration-500";
    }
}

function rafraichirDashboard() {
    if (modeCriseActif) {
        return; 
    }

    fetch(`/api/live-data?site=${currentSite}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const trame = data[0];
                
                const cpuVal = document.getElementById('cpu-value');
                const tempVal = document.getElementById('temp-value');
                const latVal = document.getElementById('latency-value');
                
                if (cpuVal) cpuVal.innerText = trame.cpu_usage_pct + ' %';
                if (tempVal) tempVal.innerText = trame.cpu_temperature_celsius + ' °C';
                if (latVal) latVal.innerText = trame.network_latency_ms + ' ms';

                const diskIO = trame.disk_io_rate || trame['disk_io_rate:'] || 120.0;
                const ramUsage = trame.ram_usage_pct || 70.0;

                fetch('/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model_key: 'random_forest',
                        site_id: currentSite,
                        cpu_usage_pct: trame.cpu_usage_pct,
                        ram_usage_pct: ramUsage,
                        cpu_temperature_celsius: trame.cpu_temperature_celsius,
                        disk_io_rate: diskIO,
                        network_latency_ms: trame.network_latency_ms
                    })
                })
                .then(res => res.json())
                .then(predResult => {
                    const statutElement = document.getElementById('status-value');
                    const alertBox = document.getElementById('predictive-alert-box');
                    const alertText = document.getElementById('predictive-alert-text');
                    
                    let estCritique = false;

                    if (predResult.status === 'success') {
                        const pred = predResult.prediction;
                        
                        if (pred === 0) {
                            if (statutElement) {
                                statutElement.innerText = '🛡️ Nominal';
                                statutElement.className = "text-xl font-black text-green-400 mt-1";
                            }
                            if (alertBox) alertBox.classList.add('hidden');
                            stopperTousLesClignotements();
                        } else if (pred === 1) {
                            if (statutElement) {
                                statutElement.innerText = '⚠️ Vigilance';
                                statutElement.className = "text-xl font-black text-yellow-500 mt-1";
                            }
                            if (alertBox) alertBox.classList.add('hidden');
                            stopperTousLesClignotements();
                        } else {
                            estCritique = true;
                            if (statutElement) {
                                statutElement.innerText = '🚨 Incident Imminent';
                                statutElement.className = "text-xl font-black text-red-500 mt-1";
                            }
                            
                            let causes = [];
                            let declencherCPU = false;
                            let declencherTemp = false;

                            if (trame.cpu_usage_pct > 70) {
                                causes.push(`Surcharge d'activité processeur à ${trame.cpu_usage_pct}% (Seuil de sécurité : 70%)`);
                                declencherCPU = true;
                            }
                            if (trame.cpu_temperature_celsius > 74) {
                                causes.push(`Surchauffe thermique détectée sur les composants physiques (${trame.cpu_temperature_celsius}°C)`);
                                declencherTemp = true;
                            }

                            if (alertText) {
                                alertText.innerHTML = `<b>Diagnostic de sécurité - Centre de Supervision :</b><br>Des anomalies physiques majeures compromettent la stabilité du site <b>${currentSite}</b> :<br>• ${causes.join('<br>• ')}.<br><span class="text-red-400 font-bold">Action requise : Déploiement d'une équipe technique sous un délai de 3 heures pour éviter l'arrêt des serveurs.</span>`;
                            }
                            
                            if (alertBox) alertBox.classList.remove('hidden');
                            if (declencherCPU) appliquerStyleClignotement('cpu-value', true);
                            if (declencherTemp) appliquerStyleClignotement('temp-value', true);

                            modeCriseActif = true;
                            setTimeout(() => {
                                modeCriseActif = false; 
                            }, 20000);
                        }

                        actualiserPlanningMaintenance(estCritique, trame.cpu_temperature_celsius);

                        if (radarChartInstance) {
                            radarChartInstance.data.datasets[0].data = [
                                predResult.probabilities.optimal,
                                predResult.probabilities.warning,
                                predResult.probabilities.critical
                            ];
                            radarChartInstance.update();
                        }
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
                if (lineChartInstance) lineChartInstance.update();

                historiqueCompletTableau.unshift({
                    horodatage: heureFormat,
                    site: trame.server_id,
                    cpu: trame.cpu_usage_pct,
                    ram: ramUsage,
                    temp: trame.cpu_temperature_celsius,
                    latence: trame.network_latency_ms
                });

                const tableBody = document.getElementById('logsTableBody');
                if (tableBody) {
                    const nouvelleLigne = document.createElement('tr');
                    nouvelleLigne.className = "hover:bg-gray-900 border-b border-gray-800 transition-all";
                    nouvelleLigne.innerHTML = `
                        <td class="p-4 text-blue-400">${heureFormat}</td>
                        <td class="p-4 text-xs font-bold text-gray-400">${trame.server_id}</td>
                        <td class="p-4">${trame.cpu_usage_pct} %</td>
                        <td class="p-4">${ramUsage} %</td>
                        <td class="p-4 text-yellow-500">${trame.cpu_temperature_celsius} °C</td>
                        <td class="p-4 text-green-400">${trame.network_latency_ms} ms</td>
                    `;
                    tableBody.insertBefore(nouvelleLigne, tableBody.firstChild);
                    if (tableBody.children.length > 50) tableBody.removeChild(tableBody.lastChild);
                }
            }
        })
        .catch(err => console.error('Erreur:', err));
}

function actualiserPlanningMaintenance(siteEnAvarie, currentTemp) {
    const planningBody = document.getElementById('planningTableBody');
    if (!planningBody) return;

    const usureCalculee = (currentTemp > 70) ? (currentTemp * 0.4).toFixed(1) : (currentTemp * 0.2).toFixed(1);
    const kpiUsure = document.getElementById('kpi-usure');
    if (kpiUsure) kpiUsure.innerText = usureCalculee + ' %';

    let dakarRow = `
        <tr class="border-b border-gray-800 hover:bg-gray-950">
            <td class="p-3 font-mono text-xs text-gray-500">REF-2026-003</td>
            <td class="p-3 font-bold text-xs">RNT-DKR-03 (Dakar)</td>
            <td class="p-3 text-xs text-gray-400">Entretien annuel des blocs de climatisation de la salle réseau</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400">PLANIFIÉ</span></td>
            <td class="p-3"><span class="text-xs text-gray-400"><i class="fa-regular fa-clock mr-1"></i>En attente</span></td>
        </tr>`;

    if (siteEnAvarie && currentSite === 'RNT-DKR-03') {
        dakarRow = `
        <tr class="border-b border-red-950 bg-red-950/20 hover:bg-red-950/30">
            <td class="p-3 font-mono text-xs text-red-400 font-bold">URG-2026-04</td>
            <td class="p-3 font-bold text-xs text-red-200">RNT-DKR-03 (Dakar)</td>
            <td class="p-3 text-xs text-red-300 font-semibold">ALERTE MATÉRIELLE : Remplacement du système de ventilation suite à surchauffe</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">IMMÉDIAT</span></td>
            <td class="p-3"><span class="text-xs text-red-400 font-bold"><i class="fa-solid fa-truck-fast mr-1"></i>Techniciens en route</span></td>
        </tr>`;
    }

    planningBody.innerHTML = `
        <tr class="border-b border-gray-800 hover:bg-gray-950">
            <td class="p-3 font-mono text-xs text-gray-500">REF-2026-001</td>
            <td class="p-3 font-bold text-xs">RNT-PRD-01 (Paris)</td>
            <td class="p-3 text-xs text-gray-400">Dépoussiérage des baies d'alimentation électriques principales</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-900/40 text-green-400">FAIBLE</span></td>
            <td class="p-3"><span class="text-xs text-green-400"><i class="fa-solid fa-check mr-1"></i>Clôturé</span></td>
        </tr>
        <tr class="border-b border-gray-800 hover:bg-gray-950">
            <td class="p-3 font-mono text-xs text-gray-500">REF-2026-002</td>
            <td class="p-3 font-bold text-xs">RNT-BRX-02 (Bordeaux)</td>
            <td class="p-3 text-xs text-gray-400">Mise à niveau logicielle des switchs de répartition secondaires</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-900/40 text-yellow-500">STANDBY</span></td>
            <td class="p-3"><span class="text-xs text-yellow-500"><i class="fa-solid fa-spinner fa-spin mr-1"></i>En cours</span></td>
        </tr>
        ${dakarRow}
    `;
}

function simulerScenario() {
    const simCpu = document.getElementById('sim-cpu');
    const simTemp = document.getElementById('sim-temp');
    const simLat = document.getElementById('sim-lat');
    
    if (!simCpu || !simTemp || !simLat) return; 

    const cpu = parseInt(simCpu.value);
    const temp = parseInt(simTemp.value);
    const lat = parseInt(simLat.value);

    const valCpu = document.getElementById('val-sim-cpu');
    const valTemp = document.getElementById('val-sim-temp');
    const valLat = document.getElementById('val-sim-lat');
    
    if (valCpu) valCpu.innerText = cpu + ' %';
    if (valTemp) valTemp.innerText = temp + ' °C';
    if (valLat) valLat.innerText = lat + ' ms';

    const card = document.getElementById('sim-response-card');
    const icon = document.getElementById('sim-icon');
    const status = document.getElementById('sim-status');
    const text = document.getElementById('sim-text');

    if (!card || !icon || !status || !text) return;

    if (cpu >= 80 || temp >= 76) {
        card.className = "bg-red-950/40 p-6 rounded-xl border border-red-900 flex flex-col justify-center items-center text-center transition-all duration-300";
        icon.className = "p-4 bg-red-900 text-red-200 rounded-full mb-3";
        icon.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-3xl"></i>`;
        status.innerText = "Évaluation : Risque d'avarie critique";
        status.className = "text-lg font-black text-red-400 uppercase";
        text.innerText = `Le profil thermique simulé dépasse les limites de tolérance constructeur. Risque de coupure matérielle imminent.`;
    } else if (cpu > 65 || temp > 68 || lat > 60) {
        card.className = "bg-yellow-950/40 p-6 rounded-xl border border-yellow-900 flex flex-col justify-center items-center text-center transition-all duration-300";
        icon.className = "p-4 bg-yellow-900 text-yellow-200 rounded-full mb-3";
        icon.innerHTML = `<i class="fa-solid fa-circle-exclamation text-3xl"></i>`;
        status.innerText = "Évaluation : Seuil d'alerte atteint";
        status.className = "text-lg font-black text-yellow-500 uppercase";
        text.innerText = `L'infrastructure entre en zone de fatigue thermique. Des ralentissements de services sont à prévoir.`;
    } else {
        card.className = "bg-gray-950 p-6 rounded-xl border border-gray-800 flex flex-col justify-center items-center text-center transition-all duration-300";
        icon.className = "p-4 bg-green-950/50 text-green-400 rounded-full mb-3";
        icon.innerHTML = `<i class="fa-solid fa-square-check text-3xl"></i>`;
        status.innerText = "Évaluation : Structure Résiliente";
        status.className = "text-lg font-black text-green-400 uppercase";
        text.innerText = `Les charges simulées sont parfaitement absorbées par le système. Stabilité garantie.`;
    }
}

function exportToCSV() {
    if (historiqueCompletTableau.length === 0) {
        alert("Aucune donnée collectée pour le moment.");
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Horodatage,Site,CPU (%),RAM (%),Temperature (C),Latence (ms)\n";
    historiqueCompletTableau.forEach(row => {
        csvContent += `${row.horodatage},${row.site},${row.cpu},${row.ram},${row.temp},${row.latence}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `registre_nexus_${currentSite}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToPDF() {
    if (historiqueCompletTableau.length === 0) {
        alert("Aucune donnée disponible.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.text(`REGISTRE DE TÉLÉMÉTRIE CAPTEURS - SITE ${currentSite}`, 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Rapport d'extraction édité le : ${new Date().toLocaleString('fr-FR')}`, 14, 22);

    const tableRows = [];
    historiqueCompletTableau.forEach(row => {
        tableRows.push([row.horodatage, row.site, row.cpu + ' %', row.ram + ' %', row.temp + ' °C', row.latence + ' ms']);
    });

    doc.autoTable({
        head: [['Horodatage', 'Code Installation', 'Charge CPU', 'Mémoire RAM', 'Température', 'Latence']],
        body: tableRows,
        startY: 28,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`rapport_site_${currentSite}.pdf`);
}

function switchTab(tabId) {
    const pDash = document.getElementById('page-dashboard');
    const pAnal = document.getElementById('page-analytics');
    const pLogs = document.getElementById('page-logs');
    
    if (pDash) pDash.classList.add('hidden');
    if (pAnal) pAnal.classList.add('hidden');
    if (pLogs) pLogs.classList.add('hidden');

    const btnDash = document.getElementById('btn-dashboard');
    const btnAnal = document.getElementById('btn-analytics');
    const btnLogs = document.getElementById('btn-logs');

    if (btnDash) btnDash.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";
    if (btnAnal) btnAnal.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";
    if (btnLogs) btnLogs.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white font-medium transition-all";

    const pTitle = document.getElementById('page-title');

    if (tabId === 'dashboard') {
        if (pDash) pDash.classList.remove('hidden');
        if (btnDash) btnDash.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        if (pTitle) pTitle.innerText = "Supervision Multi-Sites";
    } else if (tabId === 'analytics') {
        if (pAnal) pAnal.classList.remove('hidden');
        if (btnAnal) btnAnal.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        if (pTitle) pTitle.innerText = "Gestion & Planification";
    } else if (tabId === 'logs') {
        if (pLogs) pLogs.classList.remove('hidden');
        if (btnLogs) btnLogs.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium transition-all";
        if (pTitle) pTitle.innerText = "Historique des Données";
    }
}
