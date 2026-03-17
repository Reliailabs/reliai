# reliai

Python SDK for [Reliai](https://github.com/reliai/reliai) — trace AI requests, detect regressions, and debug failures at the span level.

## Install

```bash
pip install reliai
```

## Quickstart

```python
import reliai

reliai.init()

@reliai.trace
def retrieve_docs(query: str) -> list[str]:
    return [f"Document about {query}"]

with reliai.span("llm_call") as span:
    response = call_your_llm(prompt)
    span.set_trace_fields(
        model="gpt-4.1",
        provider="openai",
        input_text=prompt,
        output_text=response,
        latency_ms=elapsed_ms,
    )
```

## Auto-instrumentation

```python
reliai.init()
reliai.auto_instrument()  # instruments FastAPI, OpenAI, Anthropic, LangChain
```

Or via CLI (no code changes):

```bash
reliai-run uvicorn app:app
```

## Links

- [reliai-demo](https://github.com/reliai/reliai-demo) — run the full stack locally in 60 seconds
- [reliai-examples](https://github.com/reliai/reliai-examples) — copy-paste integrations
- [Documentation](https://reliai.dev/docs)

## License

MIT
