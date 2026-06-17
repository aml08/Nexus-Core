from flask import Flask, request, jsonify, render_template
import joblib
import pandas as pd
import os
import random
import json
import smtplib
from email.mime.text import MIMEText
from sqlalchemy import create_engine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, '..', 'templates')
STATIC_DIR = os.path.join(BASE_DIR, '..', 'static')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql+psycopg2://postgres:postgres@localhost:5432/nexus_db')

engine = None
try:
    engine = create_engine(DATABASE_URL)
except Exception:
    engine = None

models = {}
model_files = {
    'random_forest': 'random_forest_model.pkl',
    'logistic_regression': 'logistic_regression_model.pkl',
    'xgboost': 'xgboost_model.pkl'
}

for model_key, file_name in model_files.items():
    path = os.path.join(BASE_DIR, '..', 'models', file_name)
    if os.path.exists(path):
        models[model_key] = joblib.load(path)

etat_serveurs = {
    'RNT-PRD-01': {'cpu': 35.0, 'temp': 52.0},
    'RNT-BRX-02': {'cpu': 22.0, 'temp': 41.0},
    'RNT-DKR-03': {'cpu': 85.0, 'temp': 78.0}
}

alerte_deja_envoyee = {
    'RNT-PRD-01': False,
    'RNT-BRX-02': False,
    'RNT-DKR-03': False
}

def envoyer_email_notification(site, cpu, temp):
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    sender_email = os.environ.get('SENDER_EMAIL')
    sender_password = os.environ.get('SENDER_PASSWORD')
    receiver_email = os.environ.get('RECEIVER_EMAIL')

    if not sender_email or not sender_password or not receiver_email:
        print(f"[Alerte Simulation] Email non envoyé (Variables manquantes) pour le site {site}")
        return

    sujet = f"ALERTE CRITIQUE INFRASTRUCTURE - SITE {site}"
    corps = f"""Bonjour,
    
Le système de supervision a détecté des anomalies physiques lourdes sur le site {site}.
    
Mesures physiques relevées à l'instant de l'incident :
- Charge d'activité processeur : {cpu} %
- Température mesurée au cœur : {temp} °C
    
Une intervention technique immédiate est requise sur le bâtiment pour inspecter les installations électriques et la climatisation.
    
--
Ceci est une notification automatique de sécurité - Nexus Core."""

    try:
        msg = MIMEText(corps)
        msg['Subject'] = sujet
        msg['From'] = sender_email
        msg['To'] = receiver_email

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, [receiver_email], msg.as_string())
        print(f"Courriel de notification envoyé avec succès pour le site {site}.")
    except Exception as email_err:
        print(f"Échec de l'envoi du courriel : {email_err}")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/model-comparison', methods=['GET'])
def get_comparison():
    path = os.path.join(BASE_DIR, '..', 'models', 'models_comparison.json')
    if os.path.exists(path):
        with open(path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    return jsonify({'error': 'Fichier introuvable'}), 404

@app.route('/predict', methods=['POST'])
def predict():
    global alerte_deja_envoyee
    data = request.get_json()
    selected_model_key = data.get('model_key', 'random_forest')
    current_model = models.get(selected_model_key)
    
    if not current_model:
        return jsonify({'status': 'error', 'message': 'Modèle indisponible'}), 500
        
    try:
        cpu = float(data.get('cpu_usage_pct', 50.0))
        ram = float(data.get('ram_usage_pct', 70.0))
        temp = float(data.get('cpu_temperature_celsius', 55.0))
        disk = float(data.get('disk_io_rate', 120.0))
        lat = float(data.get('network_latency_ms', 15.0))
        
        features = pd.DataFrame([{
            'cpu_usage_pct': cpu,
            'ram_usage_pct': ram,
            'cpu_temperature_celsius': temp,
            'disk_io_rate': disk,
            'network_latency_ms': lat
        }])
        
        # Aligne dynamiquement l'ordre des colonnes sur celui enregistré dans le fichier pkl
        if hasattr(current_model, 'feature_names_in_'):
            features = features.reindex(columns=current_model.feature_names_in_)
        
        prediction = int(current_model.predict(features)[0])
        
        site_actuel = data.get('site_id', 'RNT-PRD-01')
        if prediction == 2:
            if not alerte_deja_envoyee.get(site_actuel, False):
                envoyer_email_notification(site_actuel, cpu, temp)
                alerte_deja_envoyee[site_actuel] = True
        else:
            alerte_deja_envoyee[site_actuel] = False
        
        if hasattr(current_model, "predict_proba"):
            probabilities = current_model.predict_proba(features)[0].tolist()
        else:
            probabilities = [0.0, 0.0, 0.0]
            probabilities[prediction] = 1.0
            
        return jsonify({
            'status': 'success',
            'model_used': selected_model_key,
            'prediction': prediction,
            'probabilities': {
                'optimal': max(0.0, min(probabilities[0], 1.0)),
                'warning': max(0.0, min(probabilities[1], 1.0)),
                'critical': max(0.0, min(probabilities[2], 1.0))
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/live-data', methods=['GET'])
def get_live_data():
    global etat_serveurs
    site = request.args.get('site', 'RNT-PRD-01')
    
    try:
        if engine is not None:
            query = f"SELECT * FROM server_metrics WHERE server_id = '{site}' ORDER BY timestamp DESC LIMIT 1;"
            df = pd.read_sql_query(query, engine)
            if not df.empty:
                return jsonify(df.to_dict(orient='records'))
    except Exception:
        pass

    timestamp = pd.Timestamp.now().isoformat()
    
    if site == 'RNT-BRX-02':
        etat_serveurs[site]['cpu'] += random.uniform(-2.0, 2.0)
        etat_serveurs[site]['temp'] += random.uniform(-0.5, 0.5)
        etat_serveurs[site]['cpu'] = max(15.0, min(etat_serveurs[site]['cpu'], 35.0))
        etat_serveurs[site]['temp'] = max(38.0, min(etat_serveurs[site]['temp'], 45.0))
        status = 0
        
    elif site == 'RNT-DKR-03':
        etat_serveurs[site]['cpu'] += random.uniform(-1.0, 3.0)
        etat_serveurs[site]['temp'] += random.uniform(-0.2, 1.0)
        etat_serveurs[site]['cpu'] = max(82.0, min(etat_serveurs[site]['cpu'], 94.0))
        etat_serveurs[site]['temp'] = max(76.5, min(etat_serveurs[site]['temp'], 83.0))
        status = 2
        
    else:
        etat_serveurs[site]['cpu'] += random.uniform(-3.0, 3.0)
        etat_serveurs[site]['temp'] += random.uniform(-1.0, 1.0)
        etat_serveurs[site]['cpu'] = max(30.0, min(etat_serveurs[site]['cpu'], 55.0))
        etat_serveurs[site]['temp'] = max(48.0, min(etat_serveurs[site]['temp'], 58.0))
        status = 0

    mock_data = [{
        'timestamp': timestamp,
        'server_id': site,
        'cpu_usage_pct': round(etat_serveurs[site]['cpu'], 1),
        'ram_usage_pct': round(random.uniform(68.0, 74.0), 1),
        'cpu_temperature_celsius': round(etat_serveurs[site]['temp'], 1),
        'disk_io_rate': round(random.uniform(110.0, 130.0), 1),
        'network_latency_ms': round(random.uniform(12.0, 18.0), 1),
        'system_status': status
    }]
    return jsonify(mock_data)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
