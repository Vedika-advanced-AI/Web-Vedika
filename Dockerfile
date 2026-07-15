# ================================================================================
# CODE VED - PRODUCTION DOCKERFILE
# Engineered by Divy Patel | Modular Architecture
# ================================================================================

# 1. Use a lightweight but compatible Python base image
FROM python:3.10-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Install system-level dependencies
# - git: Required to clone 'renderlib' from GitHub in requirements.txt
# - ffmpeg & libsndfile1: Required by 'supertonic' and 'pydub' for audio processing
# - build-essential: Sometimes needed for compiling C-extensions in Python packages
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    libsndfile1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy only requirements.txt first to leverage Docker cache
# (If requirements don't change, Docker won't reinstall packages every time)
COPY requirements.txt .

# 5. Install Python dependencies
# --no-cache-dir keeps the image size small
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of the application code (HTML, CSS, JS, Python files)
COPY . .

# 7. Hugging Face Spaces requires the app to listen on port 7860
EXPOSE 7860

# 8. Command to run the Flask application
CMD ["python", "app.py"]
