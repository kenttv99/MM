# servers/server_user.py
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.api.user_auth_routers import router as user_auth_router
from backend.api.event_routers import router as event_router
from backend.api.user_edit_routers import router as user_edit_routers
from backend.api.guests_registration_routers import router as guests_registration_routers
from backend.api.notification_routers import router as notification_router  # Новый импорт
from backend.config.auth import get_user_or_ip_key, get_current_user, create_access_token
from backend.config.logging_config import logger
from backend.config.rate_limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import uvicorn
from datetime import datetime, timedelta
from authlib.jose import jwt
from constants import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY
from backend.database.user_db import AsyncSessionLocal

app = FastAPI(
    title="User Authentication API",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.state.limiter.key_func = get_user_or_ip_key
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.mount("/images", StaticFiles(directory="private_media"), name="images")

app.include_router(user_edit_routers, prefix="/user_edits", tags=["User Edits"])
app.include_router(user_auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(event_router, prefix="/v1/public/events", tags=["Events"])
app.include_router(guests_registration_routers, prefix="/user_edits", tags=["Registration"])
app.include_router(notification_router, prefix="", tags=["Notifications"])  # Подключаем новый роутер

@app.middleware("http")
async def refresh_token_middleware(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(("/v1/public/", "/notifications/public")):
        return response

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        db = AsyncSessionLocal()
        try:
            payload = jwt.decode(token, SECRET_KEY)
            exp = payload.get("exp")
            current_time = datetime.utcnow().timestamp()
            if exp - current_time < 300:
                user = await get_current_user(token, db)
                new_token = await create_access_token(
                    data={"sub": user.email},
                    session=db,
                    expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                )
                response.headers["X-Refresh-Token"] = new_token
        except Exception as e:
            logger.error(f"Error in token refresh middleware: {str(e)}")
        finally:
            await db.close()
    return response

if __name__ == "__main__":
    uvicorn.run(
        "servers.server_user:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )