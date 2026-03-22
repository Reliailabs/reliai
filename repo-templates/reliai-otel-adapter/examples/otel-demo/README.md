# OpenTelemetry Demo → Reliai

Run the OpenTelemetry demo with Reliai receiving traces.

```bash
export RELIAI_API_KEY=your_key_here

cd opentelemetry-demo

docker compose -f docker-compose.yml -f /path/to/reliai-otel-adapter/examples/otel-demo/docker-compose.override.yaml up --build
```

Open the Reliai dashboard:

http://localhost:3000
