import urllib.request
import urllib.parse
import json
import time

def test_latency():
    try:
        # 1. Login
        login_url = "http://127.0.0.1:8000/api/auth/login"
        data = json.dumps({
            "email": "test@example.com",
            "password": "password123"
        }).encode('utf-8')
        
        req = urllib.request.Request(
            login_url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        
        t0 = time.time()
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            token = res_data["access_token"]
            print(f"Login response time: {time.time() - t0:.2f} seconds")
            
        # 2. Get Me
        me_url = "http://127.0.0.1:8000/api/auth/me"
        req = urllib.request.Request(
            me_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        t0 = time.time()
        with urllib.request.urlopen(req) as response:
            user_data = json.loads(response.read().decode())
            print(f"/api/auth/me response time: {time.time() - t0:.2f} seconds")
            
        # 3. Get Orgs
        orgs_url = "http://127.0.0.1:8000/api/auth/my-orgs"
        req = urllib.request.Request(
            orgs_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        t0 = time.time()
        with urllib.request.urlopen(req) as response:
            orgs_data = json.loads(response.read().decode())
            print(f"/api/auth/my-orgs response time: {time.time() - t0:.2f} seconds")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_latency()
