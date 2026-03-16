import reliai
from fastapi import FastAPI

reliai.init()
app = FastAPI()


@app.get("/health")
@reliai.trace
def health():
    return {"ok": True}
