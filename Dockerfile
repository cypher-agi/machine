# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

RUN npm ci

# Copy source
COPY . .

# Build shared, then server and client
RUN npm run build --workspace=shared
RUN npm run build --workspace=server
RUN npm run build --workspace=client

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install Terraform
RUN apk add --no-cache curl unzip \
    && curl -fsSL https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip -o terraform.zip \
    && unzip terraform.zip \
    && mv terraform /usr/local/bin/ \
    && rm terraform.zip \
    && terraform --version

# Copy built assets
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/src/terraform ./server/src/terraform
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/client/dist ./client/dist

# Create data directory
RUN mkdir -p /app/server/.data

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start server
CMD ["node", "server/dist/index.js"]






