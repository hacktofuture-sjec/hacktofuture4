# syntax=docker/dockerfile:1.6
# Red Agent Frontend — Vite + React, served via Nginx on port 3001
#
# Multi-stage build:
#   1. `build` stage compiles the Vite app with Node 20 alpine.
#   2. `production` stage serves the static output via Nginx.
#
# In docker-compose the `build` stage is reused with `target: build`
# to run the Vite dev server with hot reload.

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

# ---------- Stage 2: production ----------
FROM nginx:alpine AS production

# Remove the default nginx site and drop in the Red config (listens on 3001).
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3001

CMD ["nginx", "-g", "daemon off;"]
