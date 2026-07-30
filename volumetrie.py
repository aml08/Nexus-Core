import os
import pandas as pd

def analyser_volumetrie_nexus(dossier_data):
    total_octets = 0
    compteur_fichiers = 0
    formats_acceptes = ['.csv', '.json']
    registre_volume = {fmt: {'taille_octets': 0, 'nb_fichiers': 0} for fmt in formats_acceptes}
    
    for racine, repertoires, fichiers in os.walk(dossier_data):
        for fichier in fichiers:
            extension = os.path.splitext(fichier)[1].lower()
            if extension in registre_volume:
                chemin_complet = os.path.join(racine, fichier)
                poids = os.path.getsize(chemin_complet)
                registre_volume[extension]['taille_octets'] += poids
                registre_volume[extension]['nb_fichiers'] += 1
                total_octets += poids
                compteur_fichiers += 1
                
    df_volume = pd.DataFrame(registre_volume).T
    df_volume['taille_Mo'] = df_volume['taille_octets'] / (1024 * 1024)
    print(f"Nombre de fichiers analysés : {compteur_fichiers}")
    print(f"Espace disque total : {total_octets / (1024 * 1024 * 1024):.6f} Go")
    return df_volume[['nb_fichiers', 'taille_Mo']]

chemin_data = r"C:\Users\LO Adja Maguette\OneDrive - VINCI Energies\Bureau\Nexus Core\data"
print(analyser_volumetrie_nexus(chemin_data))