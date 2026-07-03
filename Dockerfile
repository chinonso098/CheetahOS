# Stage 1: Build the Angular application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build the filesystem index and Angular app
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app from build stage
COPY --from=build /app/dist/cheetah-os /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
