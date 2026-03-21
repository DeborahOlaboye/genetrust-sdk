// Centralized exports for all utility modules

import { CryptoUtils } from './crypto-utils.js';
import { DataFormatter } from './data-formatter.js';
export { CryptoUtils } from './crypto-utils.js';
export { DataFormatter } from './data-formatter.js';
export { PerformanceProfiler, profiler } from './performance-profiler.js';
export { sanitize, logSanitizer } from './sanitizeLogs.js';
export { default as logger } from './logger.js';

/**
 * Utility factory for creating utility class references.
 * Synchronous — classes are imported at module load time.
 */
export class UtilityFactory {
  static getCryptoUtils() {
    return CryptoUtils;
  }

  static getDataFormatter() {
    return DataFormatter;
  }
}
