# Dockerfile for CODE VED - Hugging Face Spaces Deployment
# Base image with Python 3.10 and system dependencies
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set working directory
WORKDIR /app

# Install system dependencies
# ffmpeg for pydub, git for renderlib, and other utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
# Note: renderlib is installed from git, supertonic may download models
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy the rest of the application
COPY app.py .
COPY index.html .

# Expose port 7860 (Hugging Face Spaces standard port)
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7860/ || exit 1

# Run the Flask application
CMD ["python", "app.py"]
