const sensitiveFields = [
  'password', 'token', 'apiKey', 'api_key', 'secret',
  'privateKey', 'private_key', 'accessToken', 'refreshToken', 'authorization',
];

export const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  Object.keys(sanitized).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  });

  return sanitized;
};

export const logSanitizer = (req, res, next) => {
  const originalReqJson = req.json;
  const originalResJson = res.json;
  const originalSend = res.send;

  if (originalReqJson) {
    req.json = function(body) { return originalReqJson.call(this, sanitize(body)); };
  }
  res.json = function(body) { return originalResJson.call(this, sanitize(body)); };
  res.send = function(body) {
    if (typeof body === 'object') return originalSend.call(this, sanitize(body));
    return originalSend.call(this, body);
  };

  next();
};
