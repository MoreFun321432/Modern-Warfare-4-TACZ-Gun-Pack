FROM node:22-alpine

WORKDIR /app
COPY . .

WORKDIR /app/web
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "server.mjs"]

