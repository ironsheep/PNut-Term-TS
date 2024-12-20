# Use the base image specified in devcontainer.json
FROM node:latest

# Install Wine
RUN dpkg --add-architecture i386 && \
  apt-get update && \
  apt-get install -y wine32 wine64
