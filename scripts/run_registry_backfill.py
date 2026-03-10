from app.workers.registry_backfill import run_registry_backfill


def main() -> None:
    result = run_registry_backfill()
    print(result)


if __name__ == "__main__":
    main()
