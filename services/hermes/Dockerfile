FROM python:3.11-slim-bookworm@sha256:528257d48c1da0dcecc2e725d1ae34498d60c965f1241e39cd6a85a8859bdf84
ARG HERMES_COMMIT=2237be355906fbe6065ce1815711eee52b2d646e
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv==0.10.4
RUN git init /opt/hermes && cd /opt/hermes && git remote add origin https://github.com/NousResearch/hermes-agent.git && git fetch --depth 1 origin ${HERMES_COMMIT} && git checkout FETCH_HEAD && test "$(git rev-parse HEAD)" = "${HERMES_COMMIT}"
WORKDIR /opt/hermes
RUN uv sync --frozen --no-dev
COPY services/hermes /opt/yamnaya
COPY scripts/camps/test-hermes.py /opt/yamnaya/test-hermes.py
RUN useradd -m -u 10001 camp && mkdir /data && chown camp:camp /data
ENV CAMP_HERMES_RUNNER=/opt/yamnaya/runner.py HERMES_SOURCE=/opt/hermes CAMP_HERMES_DATA=/data PATH=/opt/hermes/.venv/bin:$PATH
USER camp
CMD ["python", "/opt/yamnaya/server.py"]
