import reliai
from fastapi import FastAPI

reliai.init()
app = FastAPI()


@reliai.trace
def retrieve_docs(query: str):
    return {"query": query, "documents": ["retriever-rollout.md", "guardrails.md"]}


@app.get("/chat")
def chat():
    return {"answer": "rag response", "context": retrieve_docs("latest regression")}
