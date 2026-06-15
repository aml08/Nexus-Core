import time
import random
import requests
import psycopg2
from datetime import datetime
from sqlalchemy import create_engine

# Configuration des connexions
URL_API = "http://127.0.0.1:5000/predict"
ENGINE = create_engine("postgresql+psycopg2://postgres:postgres@localhost:5432/nexus_db")
SERVEURS = ["RNT-PRD-01", "RNT-PRD-02", "RNT-PRD-03"]

def generer_metriques_serveur(nom_serveur):
    # Simulation de métriques de base
    cpu = round(random.uniform(10.0, 85.0), 1)
    ram = round(random.uniform(20.0, 80.0), 1)
    temp = round(random.uniform(40.0, 75.0), 1)
    disk = round(random.uniform(50.0, 500.0), 1)
    latence = round(random.uniform(5.0, 50.0), 1)
    
    # Injection forcée d'anomalies aléatoires pour tester l'IA
    if random.random() < 0.1:
        cpu = round(random.uniform(90.0, 100.0), 1)
        temp = round(random.uniform(85.0, 95.0), 1)

    return {
        "server_id": nom_serveur,
        "cpu_usage_pct": cpu,
        "ram_usage_pct": ram,
        "cpu_temperature_celsius": temp,
        "disk_io_rate": disk,
        "network_latency_ms": latence
    }

def interroger_ia(metriques):
    try:
        # Envoi des données à l'API Flask
        payload = {
            "cpu_usage_pct": metriques["cpu_usage_pct"],
            "ram_usage_pct": metriques["ram_usage_pct"],
            "cpu_temperature_celsius": metriques["cpu_temperature_celsius"],
            "disk_io_rate": metriques["disk_io_rate"],
            "network_latency_ms": metriques["network_latency_ms"]
        }
        response = requests.post(URL_API, json=payload, timeout=2)
        if response.status_code == 200:
            return response.json().get("prediction", 0)
    except Exception as e:
        print(f"Erreur reconnexions API Flask : {e}")
    return 0

def sauvegarder_en_base(metriques, statut_ia):
    try:
        conn = ENGINE.raw_connection()
        cursor = conn.cursor()
        query = """
            INSERT INTO server_metrics (timestamp, server_id, cpu_usage_pct, ram_usage_pct, cpu_temperature_celsius, disk_io_rate, network_latency_ms, system_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """
        cursor.execute(query, (
            datetime.now(),
            metriques["server_id"],
            metriques["cpu_usage_pct"],
            metriques["ram_usage_pct"],
            metriques["cpu_temperature_celsius"],
            metriques["disk_io_rate"],
            metriques["network_latency_ms"],
            statut_ia
        ))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Erreur SQL : {e}")

def executer_simulation():
    print("Démarrage de la simulation temps réel (Ctrl+C pour quitter)...")
    while True:
        for serveur in SERVEURS:
            # 1. Génération des données métriques
            metriques = generer_metriques_serveur(serveur)
            
            # 2. Interrogation du modèle via l'API Flask
            statut_predit = interroger_ia(metriques)
            
            # 3. Sauvegarde dans PostgreSQL avec la prédiction intégrée
            sauvegarder_en_base(metriques, statut_predit)
            
            print(f"[{serveur}] Métriques envoyées. IA Prédiction : {statut_predit}")
            
        time.sleep(5)

if __name__ == "__main__":
    executer_simulation()