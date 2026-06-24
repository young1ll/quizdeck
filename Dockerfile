# syntax=docker/dockerfile:1

# ---- builder: Next standalone 빌드 → /app/.next/standalone ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
# 의존성 레이어(소스보다 먼저 — 캐시 활용)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# 소스 + 빌드(next.config.mjs 의 output:'standalone' → .next/standalone)
COPY . .
RUN pnpm build

# ---- runtime: node standalone 서버(포트 3000) ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# 비루트 실행 사용자
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs
# standalone 번들(server.js + 추적된 최소 node_modules) + 정적 자산.
# .next/static 은 standalone 트레이스에 포함되지 않아 별도로 복사한다.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# 127.0.0.1 명시 — 서버는 IPv4 0.0.0.0 바인딩이라 localhost(::1) 해석 모호성 회피.
# trailingSlash:true 이므로 슬래시 포함 경로가 308 없이 곧장 200 을 준다.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/api/health/ >/dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
