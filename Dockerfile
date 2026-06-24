 FROM node:22-slim

  RUN echo "rebuild-v2"

  RUN apt-get update && apt-get install -y \
      chromium \
      --no-install-recommends \
      && rm -rf /var/lib/apt/lists/*

  ENV PUPPETEER_SKIP_DOWNLOAD=true
  ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY . .

  CMD ["node", "agent/group-agent.mjs"]

