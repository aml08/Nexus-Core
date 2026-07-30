import requests

print("Tentative d'intrusion sur le port PostgreSQL de Render...")

try:
    # On tente d'accéder au port 5432 (Postgres) via un protocole Web (HTTP)
    requests.get("http://dpg-xxxxxxxxx-a.paris-postgres.render.com:5432", timeout=5)
except Exception as e:
    print("\n=== MESSAGE DE SÉCURITÉ INFRASTRUCTURE ===")
    print(type(e).__name__, ": L'accès au serveur a été refusé ou a expiré.")