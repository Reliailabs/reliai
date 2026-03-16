FROM python:3.12-slim

WORKDIR /app

COPY services/traffic-generator/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/traffic-generator/app.py /app/app.py

CMD ["python", "/app/app.py"]
