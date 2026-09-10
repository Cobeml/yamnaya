# Official OpenClaw 2026.9.3-browser, linux/amd64.
ARG OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw@sha256:74cb3e30007bfde497b6883fc2ccdbd15205833d0f0712eda73821222f731cc2
FROM ${OPENCLAW_IMAGE}
USER root
COPY --chown=node:node openclaw /opt/yamnaya
RUN mkdir -p /home/node/.openclaw /home/node/workspace && chown -R node:node /home/node/.openclaw /home/node/workspace /opt/yamnaya
USER node
WORKDIR /app
ENTRYPOINT ["/bin/sh", "/opt/yamnaya/entrypoint.sh"]
