from rq import Worker

from app.core.settings import get_settings
from app.db.session import get_redis


def main() -> None:
    settings = get_settings()
    redis = get_redis()
    worker = Worker([settings.rq_queue_name], connection=redis)
    worker.work()


if __name__ == "__main__":
    main()
