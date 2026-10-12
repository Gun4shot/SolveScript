FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pil poppler-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server/ ./
RUN mkdir -p storage uploads && chown -R node:node storage uploads

ENV NODE_ENV=production PYTHON_BIN=python3 PORT=10000
USER node
EXPOSE 10000
CMD ["node", "server.js"]
