# syntax=docker/dockerfile:1
FROM maven:3.9.9-eclipse-temurin-21 AS java-build
WORKDIR /build
COPY backend/pom.xml ./pom.xml
RUN --mount=type=cache,target=/root/.m2 mvn -B dependency:go-offline
COPY backend/src/main ./src/main
RUN --mount=type=cache,target=/root/.m2 mvn -B -Dmaven.test.skip=true package

FROM node:22-bookworm-slim AS node-build
WORKDIR /app/render-service
COPY render-service/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM eclipse-temurin:21-jre-jammy AS java-runtime

FROM python:3.11-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    JAVA_HOME=/opt/java/openjdk NODE_ENV=production \
    STORAGE_DIR=/var/data/storage LLM_CACHE_DIR=/var/data/storage/cache/llm \
    HF_HOME=/var/data/cache/huggingface XDG_CACHE_HOME=/var/data/cache \
    BROWSER_EXECUTABLE=/usr/bin/chromium FFMPEG_PATH=/usr/bin/ffmpeg FFPROBE_PATH=/usr/bin/ffprobe \
    SPRING_PROFILES_ACTIVE=prod JAVA_TOOL_OPTIONS=-Duser.timezone=UTC \
    HOME=/home/app PORT=10000 RENDER_CONCURRENCY=1 \
    OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2
ENV PATH="/opt/java/openjdk/bin:${PATH}"
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ffmpeg ca-certificates libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home app
COPY --from=java-runtime /opt/java/openjdk /opt/java/openjdk
COPY --from=node-build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY ml-service/requirements.txt /app/ml-service/requirements.txt
# Install CPU wheels first to avoid multi-gigabyte CUDA dependencies.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r /app/ml-service/requirements.txt
COPY --from=node-build --chown=10001:10001 /app/render-service /app/render-service
COPY --chown=10001:10001 render-service/src /app/render-service/src
COPY --chown=10001:10001 render-service/templates /app/render-service/templates
COPY --chown=10001:10001 render-service/remotion /app/render-service/remotion
COPY --chown=10001:10001 render-service/assets /app/render-service/assets
COPY --chown=10001:10001 render-service/tsconfig.json /app/render-service/tsconfig.json
COPY --chown=10001:10001 ml-service/app /app/ml-service/app
COPY --from=java-build /build/target/steerproof-backend-0.0.1-SNAPSHOT.jar /app/backend/app.jar
COPY demo/papers /app/demo/papers
COPY deploy /app/deploy
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD ["python", "/app/deploy/healthcheck.py"]
ENTRYPOINT ["python", "/app/deploy/start.py"]
