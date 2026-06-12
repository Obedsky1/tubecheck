import sys
import os

# Ensure the backend dir is on PYTHONPATH
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from fastapi.testclient import TestClient
from app.main import app

def test_login_client():
    print("Initializing TestClient...")
    client = TestClient(app)
    print("TestClient initialized successfully!")
    
    print("Sending login request...")
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    
    print(f"Response status code: {response.status_code}")
    print(f"Response data: {response.text}")

if __name__ == "__main__":
    test_login_client()
