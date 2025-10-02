FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY src ./src

# Copy logo
COPY logo.png ./logo.png

# Expose port
EXPOSE 3000

# Set default environment variables
ENV PORT=3000
ENV AUTH_PASSWORD=changeme
ENV BACKEND_URL=http://localhost:5001

# Start application
CMD ["npm", "start"]
