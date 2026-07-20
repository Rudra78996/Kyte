FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /app
COPY package*.json /app/
RUN npm ci

COPY . /app
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

WORKDIR /app
COPY package*.json /app/
COPY prisma /app/prisma
RUN npm ci --omit=dev && \
    npx prisma generate && \
    npm cache clean --force
COPY --from=build /app/dist /app/dist

ARG RELEASE_VERSION=local
LABEL org.opencontainers.image.revision=$RELEASE_VERSION

USER node
EXPOSE 3000 3001
CMD ["npm", "run", "start:prod"]
