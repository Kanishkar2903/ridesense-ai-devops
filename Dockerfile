# -----------------------------
# Stage 1: Install dependencies
# -----------------------------
FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev


# -----------------------------
# Stage 2: Production runtime
# -----------------------------
FROM node:24-alpine

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./package.json

# Remove package management tools that are not
# required while the RideSense service is running
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm \
    && rm -f /usr/local/bin/npx \
    && rm -rf /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/corepack

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]