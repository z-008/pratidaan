# TraceDrop: one container serving the API and the built web app on :8080

FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN apk add --no-cache dumb-init curl
WORKDIR /app
COPY --from=backend /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
COPY data/synthetic ./data/synthetic
COPY data/ontology ./data/ontology
COPY data/demo ./data/demo
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production PORT=8080
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fs http://localhost:8080/api/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/src/server.js"]
