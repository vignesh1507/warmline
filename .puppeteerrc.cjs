/**
 * The WhatsApp bridge drives a real Chrome. We deliberately do not download a
 * private 150 MB copy at install time:
 *
 *   - on a laptop, the bridge finds the Chrome/Chromium/Edge/Brave already there;
 *   - in Docker, the image ships Chrome and sets PUPPETEER_EXECUTABLE_PATH;
 *   - if neither applies, `pnpm chrome:install` fetches one on demand.
 *
 * Set PUPPETEER_DOWNLOAD=1 before installing to get the bundled browser anyway.
 */
module.exports = {
  skipDownload: process.env.PUPPETEER_DOWNLOAD !== "1",
};
