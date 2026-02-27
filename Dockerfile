# Stage 1: Build the React client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build the Node server
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Final production image
FROM node:20-alpine
WORKDIR /app
COPY --from=client-build /app/client/dist ./client/dist
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package*.json ./server/
COPY --from=server-build /app/server/prisma ./server/prisma

WORKDIR /app/server
RUN mkdir -p data
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Script to run migrations and start the server
CMD npx prisma migrate deploy && npm start
