import os
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
import joblib
import numpy as np
import psycopg2

app = Flask(__name__)
# Cle secrete chiffree chargee depuis l'environnement Render avec valeur de secours
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "CleSecuriseeNexus2026")

# Chargement du modele Random Forest (Moteur d'inference retenu en production)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "random_forest_model.pkl")

try:
  model = joblib.load(MODEL_PATH)
  print("Modele Random Forest charge avec succes.")
except Exception as e:
  print(f"Erreur lors du chargement du modele : {e}")
  model = None


def get_db_connection():
  """Etablit une connexion securisee a la base PostgreSQL Render via DATABASE_URL."""
  db_url = os.environ.get("DATABASE_URL")
  if not db_url:
    raise ValueError(
        "DATABASE_URL non definie dans les variables d'environnement."
    )
  return psycopg2.connect(db_url)


@app.route("/")
def index():
  """Route principale affichant le tableau de bord ou l'interface de connexion."""
  return render_template("index.html")


@app.route("/login", methods=["POST"])
def login():
  """Gestion de l'authentification des utilisateurs."""
  username = request.form.get("username")
  password = request.form.get("password")

  # Identifiants de connexion valides
  if username == "admin_nexus" and password == "Nexus2026Secure":
    session["user"] = username
    return redirect(url_for("index"))
  else:
    return render_template(
        "index.html", erreur="Identifiant ou code d'acces incorrect."
    )


@app.route("/logout")
def logout():
  """Purge de la session applicative."""
  session.pop("user", None)
  return redirect(url_for("index"))


@app.route("/api/predict-live", methods=["GET"])
def predict_live():
  """API REST distribuant la derniere mesure IoT et l'inference Random Forest."""
  if "user" not in session:
    return jsonify({"error": "Session non autorisee"}), 401

  if model is None:
    return jsonify({"error": "Modele Random Forest non disponible"}), 500

  try:
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
            SELECT cpu_usage_pct, ram_usage_pct, cpu_temperature_celsius, 
                   disk_io_rate, network_latency_ms 
            FROM server_metrics 
            ORDER BY timestamp DESC 
            LIMIT 1;
        """
    cursor.execute(query)
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
      return jsonify({"error": "Aucune donnee de telemetrie trouvee"}), 404

    # Vectorisation des caracteristiques physiques pour le modele
    features = np.array([row]).reshape(1, -1)

    # Inferences de Random Forest : 0 = Nominal, 1 = Vigilance, 2 = Critique
    prediction = int(model.predict(features)[0])
    probabilities = model.predict_proba(features)[0].tolist()

    return jsonify({
        "metrics": {
            "cpu": float(row[0]),
            "ram": float(row[1]),
            "temperature": float(row[2]),
            "disk": float(row[3]),
            "latency": float(row[4]),
        },
        "prediction": prediction,
        "confidence": round(max(probabilities) * 100, 2),
    })

  except Exception as e:
    return jsonify({"error": f"Erreur serveur : {str(e)}"}), 500


if __name__ == "__main__":
  # Lancement local pour validation de developpement
  app.run(host="127.0.0.1", port=5000, debug=True)
