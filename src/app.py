import os
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
import joblib
import numpy as np
import psycopg2

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "CleSecuriseeNexus2026")

# Chargement de l'artefact prédictif Random Forest validé lors du benchmark
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "random_forest_model.pkl")
model = joblib.load(MODEL_PATH)


def get_db_connection():
  # Connexion sécurisée via la variable d'environnement chiffrée sur Render
  connection = psycopg2.connect(os.environ.get("DATABASE_URL"))
  return connection


@app.route("/")
def home():
  if "user" in session:
    return redirect(url_for("dashboard"))
  return render_template("login.html")


@app.route("/dashboard")
def dashboard():
  if "user" not in session:
    return redirect(url_for("home"))
  return render_template("index.html")


@app.route("/api/predict-live", methods=["GET"])
def predict_live():
  if "user" not in session:
    return jsonify({"error": "Non autorise"}), 401

  # Extraction de la dernière ligne de télémétrie insérée en base
  conn = get_db_connection()
  cursor = conn.cursor()
  query = (
      "SELECT cpu_usage_pct, ram_usage_pct, cpu_temperature_celsius,"
      " disk_io_rate, network_latency_ms FROM server_metrics ORDER BY timestamp"
      " DESC LIMIT 1;"
  )
  cursor.execute(query)
  row = cursor.fetchone()
  cursor.close()
  conn.close()

  if not row:
    return jsonify({"error": "Aucune donnee disponible"}), 404

  # Préparation du vecteur pour le modèle d'intelligence artificielle
  features = np.array([row]).reshape(1, -1)

  # Inférence en temps réel: 0=Nominal, 1=Vigilance, 2=Critique
  prediction = int(model.predict(features)[0])
  probabilities = model.predict_proba(features)[0].tolist()

  return jsonify({
      "metrics": {
          "cpu": row[0],
          "ram": row[1],
          "temperature": row[2],
          "disk": row[3],
          "latency": row[4],
      },
      "prediction": prediction,
      "confidence": round(max(probabilities) * 100, 2),
  })


if __name__ == "__main__":
  # Point d'entrée pour les tests et la validation sur serveur local (localhost)
  app.run(host="127.0.0.1", port=5000, debug=True)
