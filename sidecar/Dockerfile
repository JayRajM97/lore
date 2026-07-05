FROM python:3.12-slim

WORKDIR /app

COPY requirements-deploy.txt .
RUN pip install --no-cache-dir -r requirements-deploy.txt

COPY main.py .

# Cloud Run injects $PORT (default 8080). Audio stored in /tmp (ephemeral;
# production audio is served from Firebase Storage, not this path).
ENV AUDIO_DIR=/tmp/lore-audio
ENV PORT=8080

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
