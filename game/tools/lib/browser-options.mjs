/** Use Playwright Chromium by default, or an explicitly configured browser. */
export function browserLaunchOptions(options = {}) {
  const executablePath = process.env.BATTLE_CHROME_PATH || process.env.CHROME_PATH;
  const channel = process.env.BATTLE_BROWSER_CHANNEL || 'chromium';
  const selection = executablePath ? { executablePath } : channel === 'chromium' ? {} : { channel };
  return { ...selection, ...options };
}
