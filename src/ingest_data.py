import os
import json
import psycopg2
import pandas as pd

# Configuration des paramètres de connexion à notre base locale
DB_HOST = "localhost"
DB_NAME = "nexus_db"
DB_USER = "postgres"
DB_PASS = "postgres"  

def executer_ingestion():
    print("Connexion à notre base PostgreSQL 'nexus_db'...")
    try:
        # Établissement de la connexion avec le connecteur psycopg2
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        cursor = conn.cursor()
        
        # 1. Ingestion des données quantitatives (télémetrie au format CSV)
        print("Lecture et nettoyage de notre fichier de métriques CSV...")
        df_metrics = pd.read_csv("data/telemetry_metrics.csv", encoding="ISO-8859-1")
        
        # Nettoyage préventif
        df_metrics = df_metrics.dropna(subset=['timestamp', 'server_id'])
        
        print(f"Insertion de {len(df_metrics)} lignes dans la table server_metrics...")
        query_metrics = """
            INSERT INTO server_metrics 
            (timestamp, server_id, cpu_usage_pct, ram_usage_pct, cpu_temperature_celsius, disk_io_rate, network_latency_ms, system_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        for _, row in df_metrics.iterrows():
            cursor.execute(query_metrics, (
                row['timestamp'], row['server_id'], row['cpu_usage_pct'],
                row['ram_usage_pct'], row['cpu_temperature_celsius'],
                row['disk_io_rate'], row['network_latency_ms'], int(row['system_status'])
            ))
            
        # 2. Ingestion des données semi-structurées (événements de logs au format JSON)
        print("Lecture et traitement de notre fichier journal JSON...")
        with open("data/system_logs.json", "r", encoding="utf-8") as f:
            logs_data = json.load(f)
            
        print(f"Insertion de {len(logs_data)} événements dans la table server_logs...")
        query_logs = """
            INSERT INTO server_logs (timestamp, server_id, log_level, message)
            VALUES (%s, %s, %s, %s)
        """
        
        for entry in logs_data:
            if not entry.get('timestamp') or not entry.get('server_id'):
                continue  # On ignore les entrées invalides si elles existent
            cursor.execute(query_logs, (
                entry['timestamp'], entry['server_id'], entry['level'], entry['message']
            ))
            
        # Validation 
        conn.commit()
        print("Succès total ! Notre pipeline d'ingestion a correctement chargé toutes les données.")
        
    except Exception as error:
        print(f"Erreur critique lors de l'ingestion : {error}")
        if 'conn' in locals():
            conn.rollback()  
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    executer_ingestion()