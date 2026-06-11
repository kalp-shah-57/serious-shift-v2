# Multi-stage build for the Rust read API. Works on Fly.io, Render, Koyeb, etc.
FROM rust:1-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/serious-shift-backend /usr/local/bin/app
ENV PORT=8080
EXPOSE 8080
CMD ["app"]
