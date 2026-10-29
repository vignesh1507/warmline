# The WhatsApp bridge, for running on a server rather than a laptop.
#
# Based on Puppeteer's own image, which already ships a working Chrome with all
# the system libraries it needs — the part that usually goes wrong.
FROM ghcr.io/puppeteer/puppeteer:24.38.0

USER root
WORKDIR /app

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=production \
    # Use the image's Chrome; never download another one.
    PUPPETEER_SKIP_DOWNLOAD=true \
    # Containers have no user namespace to sandbox into.
    WA_CHROME_NO_SANDBOX=true \
    # Mount a disk here so the link survives a redeploy.
    WA_SESSION_DIR=/data/wa-session

RUN corepack enable

# Manifests first, so a code change does not reinstall the world.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .puppeteerrc.cjs ./
COPY packages/shared/package.json packages/shared/
COPY apps/bridge/package.json apps/bridge/
RUN pnpm install --frozen-lockfile --filter "@warmline/bridge..."

COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/bridge ./apps/bridge

RUN mkdir -p /data && chown -R pptruser:pptruser /app /data
USER pptruser

CMD ["pnpm", "--filter", "@warmline/bridge", "start"]
