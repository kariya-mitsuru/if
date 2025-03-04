ARG BASEIMAGE=node:18-slim

FROM --platform=$BUILDPLATFORM $BASEIMAGE AS deps

# Create application directory
WORKDIR /app

# Copy package*.json
COPY package*.json .

# Install runtime dependencies
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --no-fund --omit=dev

FROM --platform=$BUILDPLATFORM $BASEIMAGE AS builder

# Create application directory
WORKDIR /app

# Install build dependencies
RUN --mount=src=package.json,target=package.json \
    --mount=src=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --no-fund

# Compile TypeScript
RUN --mount=src=package.json,target=package.json \
    --mount=src=tsconfig.json,target=tsconfig.json \
    --mount=src=tsconfig.build.json,target=tsconfig.build.json \
    --mount=src=src/,target=src/ \
    npm run build

# Set executable attributes to applications
RUN chmod +x build/if-*/index.js

FROM $BASEIMAGE

# Install lsb_release, git and ca-certificates
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get --no-install-recommends install -y \
    lsb-release git ca-certificates

# Copy entrypoint shell script
COPY bin/docker-entrypoint.sh /usr/local/bin

# Set execution user
USER 1000

# Create application directory
WORKDIR /app

# Copy runtime dependencies
COPY --from=deps --chown=node:node /app .

# Copy application
COPY --from=builder --chown=node:node /app/build build

# Link applications
RUN for a in build/if-*/index.js; do ln -s ../../$a node_modules/.bin/$(basename $(dirname $a)); done

# Set environment variables
ENV NODE_ENV=production HOST=0.0.0.0 PATH=/app/node_modules/.bin:$PATH

# Expose port
EXPOSE 3000

# Run the application
CMD ["if-api"]
