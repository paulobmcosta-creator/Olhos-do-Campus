FROM node:22.22.2-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY server ./server
COPY src ./src
COPY firebase-applet-config.json ./
RUN npm run build:server
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22.22.2-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/server ./dist/server
COPY --from=build /app/firebase-applet-config.json ./firebase-applet-config.json
USER node
CMD ["node", "dist/server/index.js"]
