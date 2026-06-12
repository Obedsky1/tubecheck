import urllib.request
import urllib.parse
import json
import sys

def test_endpoints():
    try:
        # 1. Login to get token
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
        
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            token = res_data["access_token"]
            print("Login successful! Token acquired.")
            
        # 2. Get user info/organizations to fetch org_id
        me_url = "http://127.0.0.1:8000/api/auth/me"
        req = urllib.request.Request(
            me_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(req) as response:
            user_data = json.loads(response.read().decode())
            print(f"User Info retrieved: {user_data.get('email')}")
            # Find organization
            orgs_url = "http://127.0.0.1:8000/api/auth/my-orgs"
            req = urllib.request.Request(
                orgs_url,
                headers={"Authorization": f"Bearer {token}"}
            )
            with urllib.request.urlopen(req) as org_response:
                orgs_data = json.loads(org_response.read().decode())
                print(f"Organizations: {orgs_data}")
                if not orgs_data:
                    print("ERROR: No organizations found!")
                    sys.exit(1)
                org_id = orgs_data[0]["id"]
                
        # 3. Test /api/remediation/{org_id}
        remediation_url = f"http://127.0.0.1:8000/api/remediation/{org_id}"
        req = urllib.request.Request(
            remediation_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(req) as response:
            remediation_data = json.loads(response.read().decode())
            print(f"Remediation data (count: {len(remediation_data)}): {json.dumps(remediation_data, indent=2)}")
            
        # 4. Test /api/audits/{org_id}/queue
        queue_url = f"http://127.0.0.1:8000/api/audits/{org_id}/queue"
        req = urllib.request.Request(
            queue_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(req) as response:
            queue_data = json.loads(response.read().decode())
            print(f"Queue data (count: {len(queue_data)}): {json.dumps(queue_data, indent=2)}")

        # 5. Test dashboard overview endpoint
        overview_url = f"http://127.0.0.1:8000/api/dashboard/{org_id}/overview"
        req = urllib.request.Request(
            overview_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(req) as response:
            overview_data = json.loads(response.read().decode())
            print(f"Overview data: {json.dumps(overview_data, indent=2)}")
            
        # 6. Test AI Niche Finder Analyser
        print("Testing AI Niche Finder...")
        niche_url = "http://127.0.0.1:8000/api/niche-finder/analyze"
        niche_payload = json.dumps({
            "query": "Stoic Motivation quotes",
            "format": "Shorts"
        }).encode('utf-8')
        req = urllib.request.Request(
            niche_url,
            data=niche_payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            }
        )
        with urllib.request.urlopen(req) as response:
            niche_data = json.loads(response.read().decode())
            print(f"AI Niche Finder Response: {json.dumps(niche_data, indent=2)}")
            
        print("ALL TESTS PASSED SUCCESSFULLY!")
    except Exception as e:
        print(f"FAILED with error: {e}")
        if hasattr(e, 'read'):
            print(e.read().decode())
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_endpoints()

