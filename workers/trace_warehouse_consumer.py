from app.workers.trace_warehouse_consumer import run_trace_warehouse_consumer


def main() -> None:
    run_trace_warehouse_consumer()


if __name__ == "__main__":
    main()
