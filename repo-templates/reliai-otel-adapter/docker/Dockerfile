FROM python:3.11-slim

WORKDIR /app

COPY adapter/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY adapter /app/adapter

EXPOSE 8001

CMD ["uvicorn", "adapter.main:app", "--host", "0.0.0.0", "--port", "8001"]
