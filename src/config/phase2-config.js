// Configuration settings for Phase 2 components
// Manages settings for ZK proofs, storage, and contract integration

export class Phase2Config {
    constructor(environment = 'development') {
        this.environment = environment;
        this._initializeConfig();
    }

    _initializeConfig() {
        this.config = {
            environment: this.environment,
            debug: this.environment === 'development',

            zkProofs: {
                defaultAlgorithm: 'simplified-zk-snark',
                version: '1.0.0',
                maxProofSize: 256,
                proofTypes: {
                    genePresence: { id: 1, algorithm: 'simplified-zk-snark', privacyLevel: 'high', maxTargetGenes: 100 },
                    geneAbsence: { id: 2, algorithm: 'simplified-zk-snark-absence', privacyLevel: 'high', maxTargetGenes: 100 },
                    geneVariant: { id: 3, algorithm: 'simplified-zk-snark-variant', privacyLevel: 'medium', maxVariants: 1000, confidenceThreshold: 0.8 },
                    aggregate: { id: 4, algorithm: 'simplified-zk-snark-aggregate', privacyLevel: 'medium', maxDataPoints: 10000, confidenceLevel: 0.95 }
                },
                batchSize: 10,
                timeout: 30000,
                retries: 3
            },

            ipfs: {
                host: 'localhost',
                port: 5001,
                protocol: 'http',
                timeout: 30000,
                autoPinning: true,
                compressionEnabled: true,
                encryptionEnabled: true,
                maxFileSize: 100 * 1024 * 1024,
                gateways: ['https://ipfs.io', 'https://gateway.pinata.cloud', 'https://cloudflare-ipfs.com'],
                defaultGateway: 'https://ipfs.io'
            },

            encryption: {
                algorithm: 'aes-256-gcm',
                keyDerivationIterations: 100000,
                saltLength: 32,
                ivLength: 16,
                tagLength: 16,
                accessLevels: {
                    1: { keySize: 16, algorithm: 'aes-128-gcm' },
                    2: { keySize: 24, algorithm: 'aes-192-gcm' },
                    3: { keySize: 32, algorithm: 'aes-256-gcm' }
                },
                passwordPolicy: {
                    minLength: 12,
                    requireUppercase: true,
                    requireLowercase: true,
                    requireNumbers: true,
                    requireSpecialChars: true,
                    forbiddenPatterns: ['123456', 'password', 'qwerty']
                }
            },

            contracts: {
                network: this.environment === 'production' ? 'mainnet' : 'testnet',
                addresses: {
                    geneticData: null,
                    marketplace: null,
                    verification: null,
                    compliance: null
                },
                gasLimit: 100000,
                gasPrice: 1000,
                maxRetries: 3,
                retryDelay: 2000,
                timeout: 60000
            },

            dataProcessing: {
                strictValidation: this.environment === 'production',
                validateChecksums: true,
                requireMetadata: true,
                supportedFormats: ['json', 'vcf', 'fasta', 'csv'],
                defaultFormat: 'json',
                maxDataSize: 50 * 1024 * 1024,
                maxVariants: 1000000,
                maxGenes: 100000,
                maxSequenceLength: 10000000,
                parallel: true,
                maxConcurrency: 4,
                chunkSize: 10000
            },

            logging: {
                level: this.environment === 'development' ? 'debug' : 'info',
                format: 'json',
                maxFiles: 5,
                maxSize: '10MB',
                categories: {
                    zkProofs: true,
                    storage: true,
                    contracts: true,
                    api: true,
                    security: true
                }
            },

            monitoring: {
                enabled: this.environment === 'production',
                metricsInterval: 60000,
                thresholds: {
                    proofGenerationTime: 10000,
                    storageUploadTime: 30000,
                    contractCallTime: 15000,
                    memoryUsage: 512 * 1024 * 1024
                },
                alerts: {
                    enabled: this.environment === 'production',
                    endpoints: [],
                    channels: ['email', 'slack']
                }
            }
        };

        this._applyEnvironmentOverrides();
    }

    _applyEnvironmentOverrides() {
        switch (this.environment) {
            case 'development': this._applyDevelopmentConfig(); break;
            case 'testing': this._applyTestingConfig(); break;
            case 'staging': this._applyStagingConfig(); break;
            case 'production': this._applyProductionConfig(); break;
        }
    }

    _applyDevelopmentConfig() {
        this.config.zkProofs.timeout = 60000;
        this.config.ipfs.autoPinning = false;
        this.config.encryption.passwordPolicy.minLength = 8;
        this.config.dataProcessing.strictValidation = false;
        this.config.logging.level = 'debug';
        this.config.monitoring.enabled = false;
    }

    _applyTestingConfig() {
        this.config.zkProofs.timeout = 10000;
        this.config.ipfs.host = 'localhost';
        this.config.ipfs.port = 5002;
        this.config.encryption.keyDerivationIterations = 1000;
        this.config.dataProcessing.maxDataSize = 1024 * 1024;
        this.config.logging.level = 'warn';
        this.config.monitoring.enabled = false;
    }

    _applyStagingConfig() {
        this.config.contracts.network = 'testnet';
        this.config.ipfs.host = 'staging-ipfs.genetrust.org';
        this.config.monitoring.enabled = true;
        this.config.monitoring.alerts.enabled = false;
    }

    _applyProductionConfig() {
        this.config.contracts.network = 'mainnet';
        this.config.ipfs.host = 'ipfs.genetrust.org';
        this.config.dataProcessing.strictValidation = true;
        this.config.logging.level = 'info';
        this.config.monitoring.enabled = true;
        this.config.monitoring.alerts.enabled = true;
    }

    getConfig(component = null) {
        if (!component) return { ...this.config };
        if (this.config[component]) return { ...this.config[component] };
        throw new Error(`Unknown component: ${component}`);
    }

    updateConfig(component, updates) {
        if (!this.config[component]) throw new Error(`Unknown component: ${component}`);
        this.config[component] = { ...this.config[component], ...updates };
    }

    getIPFSConfig() { return this.getConfig('ipfs'); }
    getZKProofConfig() { return this.getConfig('zkProofs'); }
    getEncryptionConfig() { return this.getConfig('encryption'); }
    getContractConfig() { return this.getConfig('contracts'); }

    setContractAddresses(addresses) {
        this.config.contracts.addresses = { ...this.config.contracts.addresses, ...addresses };
    }

    validateConfig() {
        const errors = [];
        const warnings = [];
        if (!this.config.ipfs.host) errors.push('IPFS host not configured');
        if (this.environment === 'production') {
            const addresses = this.config.contracts.addresses;
            if (!addresses.geneticData || !addresses.marketplace ||
                !addresses.verification || !addresses.compliance) {
                errors.push('Contract addresses not fully configured for production');
            }
        }
        if (this.config.encryption.keyDerivationIterations < 10000 && this.environment === 'production') {
            warnings.push('Key derivation iterations may be too low for production');
        }
        return { valid: errors.length === 0, errors, warnings };
    }

    exportConfig(includeSecrets = false) {
        const exportConfig = { ...this.config };
        if (!includeSecrets) {
            delete exportConfig.contracts.addresses;
            delete exportConfig.monitoring.alerts.endpoints;
        }
        return JSON.stringify(exportConfig, null, 2);
    }

    importConfig(jsonConfig, merge = true) {
        try {
            const importedConfig = JSON.parse(jsonConfig);
            if (merge) {
                this.config = this._deepMerge(this.config, importedConfig);
            } else {
                this.config = importedConfig;
            }
        } catch (error) {
            throw new Error(`Invalid configuration JSON: ${error.message}`);
        }
    }

    _deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    getFeatureFlags() {
        return {
            enableZKProofs: true,
            enableIPFSStorage: true,
            enableCompliance: true,
            enableMarketplace: true,
            enableBatchProcessing: this.environment !== 'testing',
            enableMetrics: this.environment === 'production',
            enableDebugLogging: this.environment === 'development'
        };
    }

    static forEnvironment(environment) {
        return new Phase2Config(environment);
    }

    static fromEnvironment() {
        const VALID_ENVIRONMENTS = ['development', 'testing', 'staging', 'production'];
        const raw = process.env.NODE_ENV || 'development';
        const environment = VALID_ENVIRONMENTS.includes(raw) ? raw : 'development';
        const config = new Phase2Config(environment);
        if (process.env.IPFS_HOST) config.updateConfig('ipfs', { host: process.env.IPFS_HOST });
        if (process.env.IPFS_PORT) {
            const port = parseInt(process.env.IPFS_PORT, 10);
            if (!isNaN(port) && port > 0 && port <= 65535) {
                config.updateConfig('ipfs', { port });
            }
        }
        return config;
    }
}
