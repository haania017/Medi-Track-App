/* Minimal structured logger. Never log secrets or full sensitive payloads. */
const levelColors = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
};

const levelWeight = { debug: 10, info: 20, warn: 30, error: 40 };
const currentWeight = levelWeight[process.env.LOG_LEVEL] || levelWeight.info;

function log(level, ...args) {
  if (levelWeight[level] < currentWeight) return;
  const color = levelColors[level] || '';
  const reset = '\x1b[0m';
  const stamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](
    `${color}[${stamp}] ${level.toUpperCase()}${reset}`,
    ...args,
  );
}

const logger = {
  debug: (...a) => log('debug', ...a),
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
};

export default logger;
