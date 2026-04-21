FROM node:20-bookworm-slim

ARG PYTHON_VERSION=3.11
ARG UV_VERSION=0.6.14

ENV DEBIAN_FRONTEND=noninteractive
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    docker.io \
    git \
    openssh-client \
    python3 \
    python3-pip \
    python3-venv \
    python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@11.6.1

RUN curl -LsSf https://astral.sh/uv/${UV_VERSION}/install.sh | sh \
  && mv /root/.local/bin/uv /usr/local/bin/uv \
  && mv /root/.local/bin/uvx /usr/local/bin/uvx

WORKDIR /workspaces/stock-screening-boost
