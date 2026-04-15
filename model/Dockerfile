FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Pre-train baseline model at image build time
RUN python train.py

EXPOSE 5050

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5050"]
