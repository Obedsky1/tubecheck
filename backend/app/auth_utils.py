import os
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import get_settings

def decrypt_token(encrypted_payload: str) -> str:
    """
    Decrypts an AES-256-GCM token payload encrypted by the frontend.
    Expected format: "ivHex:authTagHex:encryptedDataHex"
    """
    secret_key = os.environ.get("NEXT_SERVER_ENCRYPTION_KEY")
    if not secret_key:
        raise ValueError("NEXT_SERVER_ENCRYPTION_KEY environment variable is not set")

    if len(secret_key) == 64:
        key_bytes = bytes.fromhex(secret_key)
    elif len(secret_key) == 32:
        key_bytes = secret_key.encode("utf-8")
    else:
        raise ValueError("NEXT_SERVER_ENCRYPTION_KEY must be exactly 32 bytes (32 chars or 64 hex chars)")

    try:
        parts = encrypted_payload.split(":")
        if len(parts) != 3:
            raise ValueError("Invalid encrypted payload format")
            
        iv = bytes.fromhex(parts[0])
        auth_tag = bytes.fromhex(parts[1])
        ciphertext = bytes.fromhex(parts[2])
        
        # cryptography's AESGCM expects the ciphertext and auth_tag combined
        aesgcm = AESGCM(key_bytes)
        decrypted = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
        return decrypted.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decrypt token: {str(e)}")

def get_fresh_google_access_token(encrypted_refresh_token: str) -> str:
    """
    Decrypts the refresh token and fetches a fresh access token from Google.
    """
    settings = get_settings()
    refresh_token = decrypt_token(encrypted_refresh_token)
    
    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
    )
    
    response.raise_for_status()
    data = response.json()
    return data["access_token"]
