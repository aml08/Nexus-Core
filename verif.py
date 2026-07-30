import pandas as pd

chemin_csv = r"C:\Users\LO Adja Maguette\OneDrive - VINCI Energies\Bureau\Nexus Core\data\telemetry_metrics.csv"
df_telemetrie = pd.read_csv(chemin_csv)

valeurs_manquantes = df_telemetrie.isnull().sum()
pourcentage_manquant = (df_telemetrie.isnull().sum() / len(df_telemetrie)) * 100

rapport_nan = pd.DataFrame({
    'Volume Vide': valeurs_manquantes,
    'Taux Manquant (%)': pourcentage_manquant
})
print(rapport_nan)

incoherence_cpu = df_telemetrie[(df_telemetrie['cpu_usage_pct'] < 0) | (df_telemetrie['cpu_usage_pct'] > 100)]
incoherence_temp = df_telemetrie[(df_telemetrie['cpu_temperature_celsius'] < 10) | (df_telemetrie['cpu_temperature_celsius'] > 105)]

print(f"Lignes avec CPU hors norme : {len(incoherence_cpu)}")
print(f"Lignes avec Température aberrante : {len(incoherence_temp)}")