import os
import sys

# Ensure the backend dir is on PYTHONPATH
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.config import get_settings
from app.workers.task_utils import get_sync_db_session
from app.services.remediation_service import remediation_engine
from app.schemas import RemediationResponse

org_id = "5a5e7b1a-5ffd-400b-803f-5c0b1bf078c1"
print("Running remediation test...", flush=True)
try:
    with get_sync_db_session() as session:
        items = remediation_engine.generate_remediation_items(session, org_id)
        print("Success! Items count:", len(items), flush=True)
        for idx, item in enumerate(items):
            print(f"Validating item {idx}...", flush=True)
            try:
                # We need to serialize the datetime or handle fields
                validated = RemediationResponse(**item)
                print(f"Item {idx} is valid!", flush=True)
            except Exception as val_err:
                print(f"Item {idx} validation failed: {val_err}", flush=True)
                print(f"Item data: {item}", flush=True)
except Exception as e:
    import traceback
    traceback.print_exc()
