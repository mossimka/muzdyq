FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OPENCV_LOG_LEVEL=ERROR

WORKDIR /app

# libglib2.0-0/libgomp1 are required by OpenCV's DNN backend.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh \
    && useradd --create-home --uid 10001 muzdyq \
    && mkdir -p /data/media \
    && chown -R muzdyq:muzdyq /app /data

USER muzdyq

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"

CMD ["./entrypoint.sh"]
