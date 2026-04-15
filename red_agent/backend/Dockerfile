# syntax=docker/dockerfile:1.6
# Red Agent Backend — FastAPI on port 8001
#
# Build context MUST be the project root so the image can include
# the shared Python packages (core/, shared/, config/) alongside red_agent/.
#
#   docker build -f red_agent/backend/Dockerfile -t htf-red-backend .

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

# Copy only the Python packages the Red backend needs.
COPY core ./core
COPY config ./config
COPY shared ./shared
COPY red_agent ./red_agent

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8001/health || exit 1

CMD ["uvicorn", "red_agent.backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
