-- Nettoyage de notre environnement de données si les tables existent déjà
DROP TABLE IF EXISTS server_logs;
DROP TABLE IF EXISTS server_metrics;

-- 1. Table de nos indicateurs quantitatifs (Issue de notre fichier CSV)
CREATE TABLE server_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    server_id VARCHAR(50) NOT NULL,
    cpu_usage_pct NUMERIC(5, 2),
    ram_usage_pct NUMERIC(5, 2),
    cpu_temperature_celsius NUMERIC(4, 1),
    disk_io_rate NUMERIC(7, 2),
    network_latency_ms NUMERIC(6, 1),
    system_status INT NOT NULL
);

-- 2. Table de nos logs bruts d'événements (Issue de notre fichier JSON)
CREATE TABLE server_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    server_id VARCHAR(50) NOT NULL,
    log_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL
);