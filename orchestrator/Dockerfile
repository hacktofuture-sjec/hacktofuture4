FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Copy requirements from its actual location in the build context
COPY orchestrator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source needed
COPY orchestrator/ ./orchestrator/
COPY agents/       ./agents/

CMD ["uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "9000"]