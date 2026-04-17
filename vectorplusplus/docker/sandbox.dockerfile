# Use a minimal Python image for sandboxed test runs
FROM python:3.11-slim

WORKDIR /workspace

# Install common test dependencies
RUN pip install --no-cache-dir pytest pytest-mock pytest-asyncio httpx requests

# Copy project files (done at runtime via volume mount)
# This dockerfile is intentionally minimal for safety

# No network access at runtime (enforced via `docker run --network none`)
CMD ["pytest", ".", "-v", "--tb=short"]
