from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import router as api_v1_router
from app.core.logging import configure_logging
from app.core.settings import get_settings
from app.notifications.invite_delivery_notify import dispatch_invitation
from app.services.clickhouse_migrations import apply_migrations
from app.workers.scheduler import start_scheduler

configure_logging()
settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    apply_migrations()
    start_scheduler()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/reliai/invite-delivery")
async def reliai_invite_delivery(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    runtime_settings = get_settings()
    expected_token = (runtime_settings.invite_delivery_webhook_bearer_token or "").strip()
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="invite_delivery_webhook_not_configured",
        )
    expected_header = f"Bearer {expected_token}"
    if authorization != expected_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")

    payload = await request.json()
    if not isinstance(payload, dict) or payload.get("event") != "organization_invitation.created":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_payload")

    result = dispatch_invitation(payload)
    return {"accepted": True, "delivery": result}


app.include_router(api_v1_router, prefix=settings.api_v1_prefix)
