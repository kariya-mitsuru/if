#!/bin/bash

# Stop on failure
set -eu

BASEDIR=$(cd "$(dirname "$0")/.."; pwd)

unset PLUGINSDIR

atexit() {
  [[ -n ${PLUGINSDIR-} ]] && rm -rf "$PLUGINSDIR"
}

trap atexit EXIT
trap 'rc=$?; trap - EXIT; atexit; exit $?' INT PIPE TERM

PLUGINSDIR=$(mktemp --tmpdir -d "${0##*/}.XXXXXXXXXX")
# Default values
IMAGE_NAME="ghcr.io/Green-Software-Foundation/if"
IMAGE_TAG="latest"
BUILDER=multiplatform-builder

# Help message
show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -n, --name NAME         Specify image name (default: ghcr.io/Green-Software-Foundation/if)"
  echo "  -t, --tag TAG           Specify image tag (default: latest)"
  echo "  -b, --builder name      Specify builder name (default: multiplatform-builder)"
  echo "  -p, --plugins filename  Specify filename which contains additional plugins names"
  echo "  -m, --npmrc filename    Specify npmrc filename"
  echo "  -h, --help              Show this help message"
  echo ""
  echo "Example:"
  echo "  $0 --name myorg/if --tag v1.0.0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    -t|--tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    -b|--builder)
      BUILDER="$2"
      shift 2
      ;;
    -p|--plugins)
      cp "$2" "$PLUGINSDIR/plugins.txt"
      shift 2
      ;;
    -m|--npmrc)
      cp "$2" "$PLUGINSDIR/.npmrc"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Error: Unknown option $1"
      show_help
      exit 1
      ;;
  esac
done

# Check if Docker Buildx is available
if ! docker buildx version > /dev/null 2>&1; then
  echo "Error: Docker Buildx is not available. Please install the latest version of Docker Desktop or Docker Engine."
  exit 1
fi

# Create builder instance (if it doesn't exist)
if ! docker buildx inspect "$BUILDER" > /dev/null 2>&1; then
  echo "Creating multiplatform builder..."
  docker buildx create --name "$BUILDER" --driver docker-container --bootstrap
fi

# Build the full image name
FULL_IMAGE_NAME="$IMAGE_NAME:$IMAGE_TAG"

echo "Starting build: $FULL_IMAGE_NAME (platforms: linux/amd64, linux/arm64)"

# Execute the build
docker buildx build --builder "$BUILDER" --platform linux/amd64,linux/arm64 -t "$FULL_IMAGE_NAME" --build-context plugins="$PLUGINSDIR" --push --provenance=false "$BASEDIR"

echo "Build completed and pushed: $FULL_IMAGE_NAME"
