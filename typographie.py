import pandas as pd

chemin_telemetrie = r"C:\Users\LO Adja Maguette\OneDrive - VINCI Energies\Bureau\Nexus Core\data\telemetry_metrics.csv"
df_echantillon = pd.read_csv(chemin_telemetrie, nrows=5)

print("=== Typographie native des colonnes ===")
print(df_echantillon.dtypes)

print("\n=== Analyse des structures d'indexation ===")
df_echantillon.info()