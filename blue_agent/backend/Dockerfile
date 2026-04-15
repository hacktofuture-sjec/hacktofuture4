# syntax=docker/dockerfile:1.6
# Blue Agent Backend — FastAPI on port 8002
#
# Build context MUST be the project root so the image can include
# the shared Python packages (core/, shared/, config/) alongside blue_agent/.
#
#   docker build -f blue_agent/backend/Dockerfile -t htf-blue-backend .

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

# Copy only the Python packages the Blue backend needs.
COPY core ./core
COPY config ./config
COPY shared ./shared
COPY blue_agent ./blue_agent

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8002/health || exit 1

CMD ["uvicorn", "blue_agent.backend.main:app", "--host", "0.0.0.0", "--port", "8002"]
