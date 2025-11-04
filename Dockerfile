# Use Playwright's official Docker image with browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

# Set working directory
WORKDIR /usr/src/app

# Use preinstalled browsers from the base image and skip re-downloads
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy package.json and package-lock.json
COPY package*.json ./

# Install project dependencies
RUN npm ci

# Copy the rest of your project
COPY . .

# Expose the port your Express server uses
EXPOSE 10000

# Start your app
CMD ["node", "run.js"]
