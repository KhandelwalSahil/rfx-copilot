FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY scripts ./scripts
COPY src ./src
COPY dataset/rfx.json ./dataset/rfx.json
COPY .openai/hosting.json ./.openai/hosting.json
RUN npm run build && npm run validate

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/scripts/dev.mjs ./scripts/dev.mjs
COPY --from=build --chown=node:node /app/worker/index.js ./worker/index.js
USER node
EXPOSE 3000
CMD ["npm", "start"]
