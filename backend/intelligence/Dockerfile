FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY backend/intelligence ./backend/intelligence
COPY lib/network-model.mjs lib/outreach-conversation.mjs ./lib/
USER node
ENV INTELLIGENCE_HOST=0.0.0.0
EXPOSE 8091
CMD ["node", "backend/intelligence/service.ts"]
