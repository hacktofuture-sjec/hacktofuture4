"""
JWT token creation and verification for session management.
Tokens are HS256-signed and carry the user's MongoDB _id as the subject claim.
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from config import settings


def create_access_token(user_id: str, expires_days: int | None = None) -> str:
    """Create a signed JWT with the user's ID as the subject."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=expires_days or settings.SESSION_EXPIRY_DAYS
    )
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT.
    Raises JWTError on invalid/expired tokens.
    """
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise
