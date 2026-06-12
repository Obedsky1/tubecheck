import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validate the Supabase JWT token passed in the Authorization header.
    Returns the decoded token payload if valid.
    """
    settings = get_settings()
    token = credentials.credentials
    
    if not settings.SUPABASE_JWT_SECRET:
        # Fallback or warning if secret is missing (only for development)
        # In production this should not be empty
        pass
        
    try:
        # Supabase uses HS256 by default with their JWT secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False} # Sometimes audience is 'authenticated', this is safe for our internal service
        )
        
        role = payload.get("role")
        if role != "authenticated":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not an authenticated user"
            )
            
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
