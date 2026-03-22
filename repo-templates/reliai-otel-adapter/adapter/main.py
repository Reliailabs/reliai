from fastapi import FastAPI, Request

from adapter.converter import resource_attrs, send_traces

app = FastAPI()


@app.post("/otlp")
async def receive_otlp(req: Request):
    data = await req.json()
    for resource_span in data.get("resourceSpans", []):
        attrs = resource_attrs(resource_span)
        for scope_span in resource_span.get("scopeSpans", []):
            spans = scope_span.get("spans", [])
            if spans:
                send_traces(spans, attrs)
    return {"status": "ok"}
