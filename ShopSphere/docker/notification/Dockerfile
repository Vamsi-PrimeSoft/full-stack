FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --production || npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
