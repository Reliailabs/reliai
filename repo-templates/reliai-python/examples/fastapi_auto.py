import reliai
from fastapi import FastAPI

reliai.init()
reliai.auto_instrument()

app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}
