FROM node:24-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY package*.json /app/
RUN npm ci

COPY . /app
RUN npm run build

EXPOSE 3000 3001
CMD ["npm", "run", "start:prod"]

