import asyncio

import reliai

reliai.init()


@reliai.trace
def retrieve_docs(query: str):
    return {"query": query, "documents": ["incident-timeline.md"]}


@reliai.trace
async def call_llm(prompt: str):
    return f"next step: {prompt}"


async def run_agent():
    context = retrieve_docs("timeline")
    next_step = await call_llm("Investigate the regression timeline.")
    return {"status": "ok", "context": context, "next_step": next_step}


if __name__ == "__main__":
    print(asyncio.run(run_agent()))
