"""
Authentication routes — GitHub OAuth2 flow, session info, and logout.
"""

from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import RedirectResponse

from auth.dependencies import get_current_user
from auth.jwt import create_access_token
from config import settings
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── GitHub OAuth URLs ──────────────────────────────────────────────
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


@router.get("/github")
async def github_login():
    """Redirect the browser to GitHub's OAuth consent screen."""
    params = urlencode(
        {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
            "scope": "read:user user:email repo",
        }
    )
    return RedirectResponse(url=f"{GITHUB_AUTHORIZE_URL}?{params}")


@router.get("/github/callback")
async def github_callback(code: str = Query(...), response: Response = None):
    """
    GitHub redirects here with a temporary `code`.
    Exchange it for an access token, upsert the user, issue a JWT cookie,
    then redirect to the frontend dashboard.
    """
    # 1️⃣  Exchange code → access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()

    access_token = token_data.get("access_token")
    if not access_token:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")

    # 2️⃣  Fetch GitHub profile
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        gh_user = user_resp.json()

    # 3️⃣  Upsert user in MongoDB
    user = await User.find_one(User.github_id == gh_user["id"])
    now = datetime.now(timezone.utc)

    if user is None:
        user = User(
            github_id=gh_user["id"],
            username=gh_user["login"],
            display_name=gh_user.get("name"),
            email=gh_user.get("email"),
            avatar_url=gh_user.get("avatar_url"),
            github_access_token=access_token,
            last_login=now,
            created_at=now,
        )
        await user.insert()
    else:
        user.github_access_token = access_token
        user.last_login = now
        user.display_name = gh_user.get("name") or user.display_name
        user.email = gh_user.get("email") or user.email
        user.avatar_url = gh_user.get("avatar_url") or user.avatar_url
        await user.save()

    # 4️⃣  Issue JWT session cookie & redirect to dashboard
    jwt_token = create_access_token(str(user.id))
    redirect = RedirectResponse(
        url=f"{settings.FRONTEND_URL}/dashboard", status_code=302
    )
    redirect.set_cookie(
        key="piq_session",
        value=jwt_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.SESSION_EXPIRY_DAYS * 86400,
    )
    return redirect


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Return the authenticated user's profile (excludes sensitive fields)."""
    return {
        "id": str(user.id),
        "github_id": user.github_id,
        "username": user.username,
        "display_name": user.display_name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "last_login": user.last_login.isoformat(),
        "created_at": user.created_at.isoformat(),
    }


@router.post("/logout")
async def logout(response: Response):
    """Clear the session cookie."""
    response.delete_cookie(
        key="piq_session",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        domain=settings.COOKIE_DOMAIN,
    )
    return {"detail": "Logged out"}
