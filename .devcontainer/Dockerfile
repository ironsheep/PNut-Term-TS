FROM node:latest

# Install Docker CLI only (not the full Docker engine)
RUN apt-get update && \
  apt-get install -y apt-transport-https \
  ca-certificates \
  curl \
  gnupg

RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
RUN . /etc/os-release \
  && echo \
  "deb [arch=arm64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  ${VERSION_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

RUN apt-get clean && apt-get update && apt-get install -y docker-ce-cli

# Switch to the node user
#USER node

# Set up your application
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Your other application setup steps here
