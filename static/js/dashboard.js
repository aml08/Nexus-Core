function rafraichirDashboard() {
    fetch('/api/live-data')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                // On récupère la ligne la plus récente (le dernier enregistrement)
                const derniereMetrique = data[0];
                
                // Mise à jour du CPU
                document.getElementById('cpu-value').innerText = derniereMetrique.cpu_usage_pct + ' %';
                
                // Mise à jour de la Température
                document.getElementById('temp-value').innerText = derniereMetrique.cpu_temperature_celsius + ' °C';
                
                // Mise à jour du Statut Global (géré par l'IA)
                const statutId = derniereMetrique.system_status;
                const statutElement = document.getElementById('status-value');
                
                if (statutId === 0) {
                    statutElement.innerText = 'Optimal';
                    statutElement.className = 'text-2xl font-bold text-green-400 mt-2';
                } else if (statutId === 1) {
                    statutElement.innerText = 'Warning';
                    statutElement.className = 'text-2xl font-bold text-yellow-500 mt-2';
                } else if (statutId === 2) {
                    statutElement.innerText = 'Critical';
                    statutElement.className = 'text-2xl font-bold text-red-500 mt-2';
                }
            }
        })
        .catch(error => console.error('Erreur lors de la récupération des données:', error));
}

// Rafraîchir les données toutes les 2 secondes
setInterval(rafraichirDashboard, 2000);

// Premier lancement au chargement de la page
document.addEventListener('DOMContentLoaded', rafraichirDashboard);