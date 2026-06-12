"""Start the FastAPI backend server with proper error capture."""
import sys
import os
import traceback

# Ensure the backend dir is on PYTHONPATH
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

print(f"Working directory: {os.getcwd()}", flush=True)
print(f"Python: {sys.executable}", flush=True)
print(f"Python version: {sys.version}", flush=True)

try:
    import asyncio
    import platform
    if platform.system() == "Windows":
        print("Setting SelectorEventLoopPolicy for Windows compatibility...", flush=True)
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    print("Importing app...", flush=True)
    from app.main import app
    print("App imported successfully!", flush=True)
    
    import uvicorn
    print("Starting uvicorn on port 8000...", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
except Exception as e:
    print(f"ERROR: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)
