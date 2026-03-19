// Centralized exports for all utility modules

export { CryptoUtils } from './crypto-utils.js';
export { DataFormatter } from './data-formatter.js';
export { PerformanceProfiler, profiler } from './performance-profiler.js';
export { sanitize, logSanitizer } from './sanitizeLogs.js';
export { default as logger } from './logger.js';

/**
 * Utility factory for creating utility instances
 */
export class UtilityFactory {
    static getCryptoUtils() {
        const { CryptoUtils } = await import('./crypto-utils.js').then(m => m);
        return CryptoUtils;
    }

    static getDataFormatter() {
        const { DataFormatter } = await import('./data-formatter.js').then(m => m);
        return DataFormatter;
    }
}

// Eager static factory (non-async version)
import { CryptoUtils } from './crypto-utils.js';
import { DataFormatter } from './data-formatter.js';

UtilityFactory.getCryptoUtils = () => CryptoUtils;
UtilityFactory.getDataFormatter = () => DataFormatter;
