from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

payload = "3693d71d9fd562ea8269d0d8:606bbaeb6d2622de3c1d40f0774bc535:eec5c8de6be4f1d9a77041bfbd9b4280c47f6fa7c39db983eab6610b9f984c6d9d13fa7966c1aea604f8664b"
secret_key = "fb4b6ac20b3c9b6e615b4ac5a274e6076b489494053456e94ae587d62f46d341"

key_bytes = bytes.fromhex(secret_key)
parts = payload.split(":")
iv = bytes.fromhex(parts[0])
auth_tag = bytes.fromhex(parts[1])
ciphertext = bytes.fromhex(parts[2])

aesgcm = AESGCM(key_bytes)
decrypted = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
print("Decrypted successfully:", decrypted.decode("utf-8"))
