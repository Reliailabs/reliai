import asyncio

import reliai

reliai.init()


@reliai.trace
def retrieve_docs(query: str):
    return {"query": query, "documents": ["pricing.md", "support.md"]}


@reliai.trace
async def call_llm(prompt: str):
    return f"answer: {prompt}"


async def main():
    print(retrieve_docs("refund policy"))
    print(await call_llm("Summarize the refund policy."))


if __name__ == "__main__":
    asyncio.run(main())
