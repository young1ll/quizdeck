# syntax=docker/dockerfile:1

# ---- builder: Next 정적 export → /app/out ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
# 의존성 레이어(소스보다 먼저 — 캐시 활용)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# 소스 + 빌드(next.config.mjs 의 output:'export' → out/)
COPY . .
RUN pnpm build

# ---- runtime: nginx 가 out/ 정적 서빙 ----
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
