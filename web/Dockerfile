FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /app
COPY package*.json /app/
RUN npm ci
COPY . /app

# NEXT_PUBLIC values are compiled into the browser bundle by Next.js. Supply
# them as build args; never copy or pass CLERK_SECRET_KEY to this build stage.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITES_DOMAIN
ARG NEXT_PUBLIC_SITES_SCHEME
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SITES_DOMAIN=$NEXT_PUBLIC_SITES_DOMAIN
ENV NEXT_PUBLIC_SITES_SCHEME=$NEXT_PUBLIC_SITES_SCHEME

RUN test -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
RUN npm run build

FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY package*.json /app/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.next /app/.next
COPY --from=build /app/public /app/public

ARG RELEASE_VERSION=local
LABEL org.opencontainers.image.revision=$RELEASE_VERSION

USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
