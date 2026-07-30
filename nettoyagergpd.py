import re
import json
import os

def filtrer_logs_rgpd_final(chemin_entree, chemin_sortie):
    regex_ip = r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b'
    
    if not os.path.exists(chemin_entree):
        return
        
    with open(chemin_entree, 'r', encoding='utf-8') as f:
        try:
            donnees = json.load(f)
        except json.JSONDecodeError:
            return

    def corriger_message(element):
        if isinstance(element, dict):
            if 'message' in element and isinstance(element['message'], str):
                element['message'] = re.sub(regex_ip, "[ADRESSE_IP_ANONYMISEE]", element['message'])
            for valeur in element.values():
                corriger_message(valeur)
        elif isinstance(element, list):
            for item in element:
                corriger_message(item)

    corriger_message(donnees)

    with open(chemin_sortie, 'w', encoding='utf-8') as f:
        json.dump(donnees, f, indent=4, ensure_ascii=False)

dossier_data = r"C:\Users\LO Adja Maguette\OneDrive - VINCI Energies\Bureau\Nexus Core\data"
filtrer_logs_rgpd_final(os.path.join(dossier_data, "system_logs.json"), os.path.join(dossier_data, "system_logs_clean.json"))