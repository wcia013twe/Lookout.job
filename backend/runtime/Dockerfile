FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV LOOKOUT_CHROMIUM_EXECUTABLE=/usr/bin/chromium
RUN apk add --no-cache chromium
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY backend/runtime ./backend/runtime
COPY supabase/functions ./supabase/functions
COPY lib ./lib
COPY runner/submit.mjs runner/runtime.mjs runner/prepare.mjs runner/browser.mjs runner/ats.mjs runner/forms.mjs runner/attempt.mjs runner/profile-upload.mjs ./runner/
COPY runner/vendor/application-controls.mjs ./runner/vendor/
COPY runner/career-tools.mjs runner/career-worker.mjs runner/public-source.mjs runner/career-search-intake.mjs runner/career-liveness.mjs runner/career-search-filters.mjs runner/gateway-client.mjs ./runner/
COPY runner/vendor/career-ops ./runner/vendor/career-ops
USER node
EXPOSE 8080
CMD ["node", "backend/runtime/main.ts"]
