FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (supports both root and backend contexts)
COPY requirements.txt* backend/requirements.txt* ./
RUN if [ -f backend/requirements.txt ]; then pip install --no-cache-dir -r backend/requirements.txt; else pip install --no-cache-dir -r requirements.txt; fi

# Copy application source code
COPY . .
RUN if [ -d backend/app ]; then cp -r backend/* /app/ 2>/dev/null || true; fi

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
