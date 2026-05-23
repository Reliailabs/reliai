from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import router as api_v1_router
from app.core.logging import configure_logging
from app.core.settings import get_settings
from app.notifications.invite_delivery_notify import dispatch_invitation
from app.security.webhook_replay_guard import invite_delivery_replay_guard
from app.security.webhook_signing import verify_webhook_signature
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
    x_reliai_signature_version: str | None = Header(default=None),
    x_reliai_timestamp: str | None = Header(default=None),
    x_reliai_signature: str | None = Header(default=None),
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

    raw_body = await request.body()
    signing_secret = (runtime_settings.invite_delivery_webhook_signing_secret or "").strip()
    if signing_secret:
        if not x_reliai_signature_version or not x_reliai_timestamp or not x_reliai_signature:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_signature")
        expected_signature_version = (runtime_settings.invite_delivery_webhook_signature_version or "v1").strip() or "v1"
        if x_reliai_signature_version != expected_signature_version:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unsupported_signature_version")
        try:
            timestamp = int(x_reliai_timestamp)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_signature") from exc
        valid = verify_webhook_signature(
            secret=signing_secret,
            timestamp=timestamp,
            signature=x_reliai_signature,
            body=raw_body,
            max_age_seconds=max(1, runtime_settings.invite_delivery_webhook_signature_max_age_seconds),
        )
        if not valid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_signature")
        replay_key = f"{timestamp}:{x_reliai_signature}"
        accepted_once = invite_delivery_replay_guard.register(
            key=replay_key,
            ttl_seconds=max(1, runtime_settings.invite_delivery_webhook_signature_max_age_seconds),
        )
        if not accepted_once:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="replay_detected")

    payload = await request.json()
    if not isinstance(payload, dict) or payload.get("event") != "organization_invitation.created":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_payload")

    result = dispatch_invitation(payload)
    return {"accepted": True, "delivery": result}


app.include_router(api_v1_router, prefix=settings.api_v1_prefix)
