FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs data ai/models templates

# Set environment variables
ENV PYTHONPATH=/app
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

# Create non-root user
RUN useradd -m -u 1000 automation && \
    chown -R automation:automation /app
USER automation

# Expose port for web dashboard
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/api/stats')" || exit 1

# Default command
CMD ["python", "main.py"]