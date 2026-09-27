FROM node:20-alpine

WORKDIR /app


COPY package*.json ./
RUN npm ci


COPY . .
RUN npm run build


ENV NODE_ENV=production
EXPOSE 5000


CMD ["node", "dist/index.js"]