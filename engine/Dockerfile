FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

RUN pip install --no-cache-dir uv

# Build context is the repo root (set in docker-compose.yml)
COPY engine/requirements.txt .
# Install CPU-only torch first (avoids 2GB+ of NVIDIA CUDA libs)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN uv pip install --system --no-cache -r requirements.txt

# Copy engine service and the rekall_engine module
COPY engine/ /app/engine/
COPY rekall_engine/ /app/rekall_engine/

WORKDIR /app/engine

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
