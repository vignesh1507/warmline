const stamp = () => new Date().toLocaleTimeString();

export const log = {
  info: (...args: unknown[]) => console.log(`[${stamp()}]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${stamp()}] !`, ...args),
  error: (...args: unknown[]) => console.error(`[${stamp()}] x`, ...args),
};
