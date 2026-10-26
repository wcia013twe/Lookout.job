FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY backend/runtime ./backend/runtime
COPY supabase/functions ./supabase/functions
COPY lib ./lib
COPY runner/career-tools.mjs runner/career-worker.mjs runner/gateway-client.mjs ./runner/
COPY runner/vendor/career-ops ./runner/vendor/career-ops
USER node
EXPOSE 8080
CMD ["node", "backend/runtime/main.ts"]
