FROM golang:1.24.6-alpine3.22@sha256:c8c5f95d64aa79b6547f3b626eb84b16a7ce18a139e3e9ca19a8c078b85ba80d AS build

RUN apk add --no-cache git
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
RUN mkdir /src && \
    git -C /src init && \
    git -C /src remote add origin https://github.com/minio/minio.git && \
    git -C /src fetch --depth 1 origin "$MINIO_COMMIT" && \
    git -C /src checkout --detach FETCH_HEAD && \
    test "$(git -C /src rev-parse HEAD)" = "$MINIO_COMMIT"
WORKDIR /src
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /minio

FROM alpine:3.22.1@sha256:4bcff63911fcb4448bd4fdacec207030997caf25e9bea4045fa6c8c44de311d1

RUN apk add --no-cache ca-certificates curl && \
    addgroup -g 10001 minio && \
    adduser -D -H -u 10001 -G minio minio
COPY --from=build /minio /usr/local/bin/minio

ARG RELEASE_VERSION=local
LABEL org.opencontainers.image.revision=$RELEASE_VERSION

USER 10001:10001
EXPOSE 9000 9001
ENTRYPOINT ["/usr/local/bin/minio"]
