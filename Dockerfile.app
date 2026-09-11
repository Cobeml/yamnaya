FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS source-deps
RUN npm install --global pnpm@10.32.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile
FROM source-deps AS source
COPY . .
RUN mkdir -p /app/runtime && chown node:node /app/runtime

FROM source AS worker
USER node
CMD ["node_modules/.bin/tsx", "services/worker/camps.ts"]

FROM source-deps AS camp-sandbox
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*
ARG QUARTO_VERSION=1.8.21
RUN curl -fsSL "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.deb" -o /tmp/quarto.deb && dpkg -i /tmp/quarto.deb && rm /tmp/quarto.deb
RUN python3 -m venv /opt/quarto-python && /opt/quarto-python/bin/pip install --no-cache-dir jupyter==1.1.1 matplotlib==3.10.6 pandas==2.3.2 pyyaml==6.0.2
ENV QUARTO_PYTHON=/opt/quarto-python/bin/python PATH="/opt/quarto-python/bin:${PATH}" CAMP_SANDBOX_ISOLATED=1
COPY . .
USER node
CMD ["node_modules/.bin/tsx", "services/sandbox/index.ts"]

FROM source-deps AS camp-browser
USER root
RUN node_modules/.bin/playwright install --with-deps chromium && mv /root/.cache/ms-playwright /opt/playwright && chmod -R a+rX /opt/playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright CAMP_BROWSER_ISOLATED=1
COPY . .
USER node
CMD ["node_modules/.bin/tsx", "services/browser/index.ts"]

FROM source AS web-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3110
CMD ["node", "apps/web/server.js"]
