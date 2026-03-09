from fastapi import FastAPI

from app.api.v1.routes import router as api_v1_router
from app.core.logging import configure_logging
from app.core.settings import get_settings

configure_logging()
settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_v1_router, prefix=settings.api_v1_prefix)
