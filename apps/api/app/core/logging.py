import logging
from logging.config import dictConfig

from app.core.settings import get_settings


def configure_logging() -> None:
    settings = get_settings()
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "standard": {
                    "format": "%(asctime)s %(levelname)s %(name)s %(message)s"
                }
            },
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "formatter": "standard",
                }
            },
            "root": {"handlers": ["default"], "level": settings.log_level},
        }
    )
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
