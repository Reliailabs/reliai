import reliai

reliai.init()


@reliai.trace
def retrieve_docs(query: str):
    return {"query": query, "documents": ["doc1", "doc2"]}


@reliai.trace
async def call_llm(prompt: str):
    return f"answer: {prompt}"
