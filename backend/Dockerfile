FROM node:22-alpine
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm db:generate
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]
