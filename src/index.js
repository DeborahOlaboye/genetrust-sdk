// Main GeneTrust SDK entry point
// Provides high-level interface for all GeneTrust functionality

import { Phase2Config } from './config/phase2-config.js';
import { PerformanceConfig } from './config/performance-config.js';
import { ZKProofFactory } from './zk-proofs/index.js';
import { StorageFactory } from './storage/index.js';
import { ContractFactory } from './contracts/index.js';
import { UtilityFactory } from './utils/index.js';
import { profiler } from './utils/performance-profiler.js';
import logger from './utils/logger.js';

/**
 * Main GeneTrust SDK Class
 * Provides a unified interface for all GeneTrust functionality
 */
export class GeneTrust {
    constructor(options = {}) {
        // Initialize configuration
        this.config = options.config || Phase2Config.fromEnvironment();
        this.performanceConfig = PerformanceConfig.getConfig(process.env.NODE_ENV || 'development');

        // Initialize components with performance optimizations
        this._initializeComponents(options);

        // Track initialization state
        this.initialized = false;

        // Start performance monitoring if enabled
        if (this.performanceConfig.performanceMonitoring) {
            this._initializePerformanceMonitoring();
        }
    }

    /**
     * Initialize all SDK components with performance optimizations
     * @private
     */
    _initializeComponents(options) {
        // Storage stack with performance config
        this.storage = StorageFactory.createGeneticDataStack({
            ipfs: {
                ...this.config.getIPFSConfig(),
                maxConcurrentUploads: this.performanceConfig.maxConcurrentUploads,
                batchSize: this.performanceConfig.batchSize,
                retryAttempts: this.performanceConfig.retryAttempts,
                timeout: this.performanceConfig.timeout
            },
            encryption: {
                ...this.config.getEncryptionConfig(),
                keyDerivationIterations: this.performanceConfig.keyDerivationIterations
            },
            storage: {
                cacheEnabled: this.performanceConfig.cacheEnabled,
                cacheSize: this.performanceConfig.cacheSize,
                ...options.storage
            }
        });

        // ZK Proof components
        this.zkProofs = {
            factory: ZKProofFactory,
            verifier: ZKProofFactory.createVerifier()
        };

        // Contract clients (will be initialized after setup)
        this.contracts = null;

        // Utilities
        this.utils = {
            crypto: UtilityFactory.getCryptoUtils(),
            formatter: UtilityFactory.getDataFormatter()
        };
    }

    /**
     * Initialize the SDK with contract addresses and Stacks API
     * @param {Object} stacksApi - Stacks API instance
     * @param {Object} contractAddresses - Contract addresses
     * @returns {Promise<void>}
     */
    async initialize(stacksApi, contractAddresses = null) {
        try {
            // Set contract addresses if provided
            if (contractAddresses) {
                this.config.setContractAddresses(contractAddresses);
            }

            // Initialize contract clients
            this.contracts = ContractFactory.create(
                this.config.getContractConfig(),
                stacksApi
            ).createAllClients();

            // Test storage connectivity
            const connectivityTest = await this.storage.storage.testConnectivity();
            if (!connectivityTest.overall) {
                logger.warn('Storage connectivity issues detected', { error: connectivityTest.error });
            }

            this.initialized = true;
        } catch (error) {
            throw new Error(`SDK initialization failed: ${error.message}`);
        }
    }

    /**
     * Store genetic data with encryption and zero-knowledge proofs
     * @param {Object} geneticData - Raw genetic data
     * @param {string} password - Encryption password
     * @param {Object} options - Storage options
     * @returns {Promise<Object>} Storage result with proofs
     */
    async storeGeneticData(geneticData, password, options = {}) {
        this._ensureInitialized();

        const operationId = `store_genetic_data_${Date.now()}`;
        profiler.start(operationId, { dataSize: JSON.stringify(geneticData).length });

        try {
            profiler.checkpoint(operationId, 'formatting_data');
            const formattedData = await this.utils.formatter.formatForStorage(geneticData, options.format);

            profiler.checkpoint(operationId, 'storing_data');
            const storageResult = await this.storage.storage.storeGeneticData(
                formattedData,
                password,
                options.storage
            );

            const proofs = {};
            if (options.generateProofs) {
                proofs.genePresence = await this._generateGenePresenceProofs(
                    formattedData,
                    options.proofs?.genePresence
                );
                proofs.variants = await this._generateVariantProofs(
                    formattedData,
                    options.proofs?.variants
                );
                proofs.aggregate = await this._generateAggregateProofs(
                    formattedData,
                    options.proofs?.aggregate
                );
            }

            let blockchainResult = null;
            if (this.contracts && options.registerOnChain) {
                blockchainResult = await this._registerOnBlockchain(
                    storageResult,
                    proofs,
                    options.blockchain
                );
            }

            const result = {
                success: true,
                datasetId: storageResult.datasetId,
                storage: storageResult,
                proofs,
                blockchain: blockchainResult,
                storedAt: Date.now()
            };

            profiler.end(operationId);
            return result;
        } catch (error) {
            profiler.end(operationId);
            throw new Error(`Failed to store genetic data: ${error.message}`);
        }
    }

    /**
     * Retrieve and decrypt genetic data
     * @param {string} datasetId - Dataset identifier or storage URL
     * @param {string} password - Decryption password
     * @param {number} accessLevel - Requested access level
     * @param {Object} options - Retrieval options
     * @returns {Promise<Object>} Decrypted genetic data
     */
    async retrieveGeneticData(datasetId, password, accessLevel = 1, options = {}) {
        this._ensureInitialized();

        try {
            const retrievalResult = await this.storage.storage.retrieveGeneticData(
                datasetId,
                password,
                accessLevel,
                options.storage
            );

            let proofVerification = null;
            if (options.verifyProofs && retrievalResult.metadata?.proofs) {
                proofVerification = await this._verifyProofs(
                    retrievalResult.data,
                    retrievalResult.metadata.proofs
                );
            }

            let permissionCheck = null;
            if (this.contracts && options.checkPermissions) {
                permissionCheck = await this._checkBlockchainPermissions(
                    datasetId,
                    options.userAddress,
                    accessLevel
                );
            }

            return {
                success: true,
                data: retrievalResult.data,
                accessLevel: retrievalResult.accessLevel,
                metadata: retrievalResult.metadata,
                proofVerification,
                permissionCheck,
                retrievedAt: Date.now()
            };
        } catch (error) {
            throw new Error(`Failed to retrieve genetic data: ${error.message}`);
        }
    }

    /**
     * Create a marketplace listing for genetic data
     * @param {Object} listingData - Listing information
     * @param {string} senderAddress - Seller's address
     * @param {Object} options - Listing options
     * @returns {Promise<Object>} Listing result
     */
    async createMarketplaceListing(listingData, senderAddress, options = {}) {
        this._ensureInitialized();

        if (!this.contracts) {
            throw new Error('Contract clients not initialized');
        }

        try {
            const formattedListing = this.utils.formatter.formatForContract(
                listingData,
                'marketplace'
            );

            const listingResult = await this.contracts.marketplace.createListing(
                formattedListing,
                senderAddress
            );

            let complianceResult = null;
            if (options.setupCompliance) {
                complianceResult = await this._setupCompliance(
                    listingData.dataId,
                    senderAddress,
                    options.compliance
                );
            }

            return {
                success: true,
                listingId: formattedListing.listingId,
                transaction: listingResult,
                compliance: complianceResult,
                createdAt: Date.now()
            };
        } catch (error) {
            throw new Error(`Failed to create marketplace listing: ${error.message}`);
        }
    }

    /**
     * Purchase genetic data from marketplace
     * @param {number} listingId - Listing ID
     * @param {number} accessLevel - Requested access level
     * @param {string} buyerAddress - Buyer's address
     * @param {Object} options - Purchase options
     * @returns {Promise<Object>} Purchase result
     */
    async purchaseGeneticData(listingId, accessLevel, buyerAddress, options = {}) {
        this._ensureInitialized();

        if (!this.contracts) {
            throw new Error('Contract clients not initialized');
        }

        try {
            const eligibilityCheck = await this.contracts.marketplace.verifyPurchaseEligibility(
                listingId,
                accessLevel
            );

            if (!eligibilityCheck) {
                throw new Error('Purchase not eligible - requirements not met');
            }

            const txId = this.utils.crypto.generateSecureKey(32, 'buffer');

            const purchaseResult = await this.contracts.marketplace.purchaseListingDirect(
                listingId,
                accessLevel,
                txId,
                buyerAddress
            );

            if (options.logAccess !== false) {
                await this.contracts.compliance.logDataAccess(
                    listingId,
                    1,
                    txId,
                    buyerAddress
                );
            }

            return {
                success: true,
                listingId,
                accessLevel,
                transaction: purchaseResult,
                txId: Array.from(txId),
                purchasedAt: Date.now()
            };
        } catch (error) {
            throw new Error(`Failed to purchase genetic data: ${error.message}`);
        }
    }

    /**
     * Generate zero-knowledge proofs for genetic data
     * @param {Object} geneticData - Genetic data
     * @param {Object} proofRequests - Proof generation requests
     * @returns {Promise<Object>} Generated proofs
     */
    async generateProofs(geneticData, proofRequests) {
        try {
            const proofs = {};

            if (proofRequests.genePresence) {
                const generator = this.zkProofs.factory.createGenerator('gene-presence');
                proofs.genePresence = [];
                for (const request of proofRequests.genePresence) {
                    const proof = await generator.generatePresenceProof(
                        geneticData,
                        request.targetGene,
                        request.options
                    );
                    proofs.genePresence.push(proof);
                }
            }

            if (proofRequests.variants) {
                const generator = this.zkProofs.factory.createGenerator('gene-variant');
                proofs.variants = [];
                for (const request of proofRequests.variants) {
                    const proof = await generator.generateVariantProof(
                        geneticData,
                        request.targetVariant,
                        request.options
                    );
                    proofs.variants.push(proof);
                }
            }

            if (proofRequests.aggregate) {
                const generator = this.zkProofs.factory.createGenerator('aggregate');
                proofs.aggregate = [];
                for (const request of proofRequests.aggregate) {
                    const proof = await generator.generateAggregateProof(
                        geneticData,
                        request.aggregateQuery,
                        request.options
                    );
                    proofs.aggregate.push(proof);
                }
            }

            return proofs;
        } catch (error) {
            throw new Error(`Failed to generate proofs: ${error.message}`);
        }
    }

    /**
     * Verify zero-knowledge proofs
     * @param {Object} proofs - Proofs to verify
     * @param {Object} publicInputs - Public inputs for verification
     * @returns {Promise<Object>} Verification results
     */
    async verifyProofs(proofs, publicInputs) {
        try {
            const results = {};

            for (const [proofType, proofList] of Object.entries(proofs)) {
                results[proofType] = [];
                for (let i = 0; i < proofList.length; i++) {
                    const proof = proofList[i];
                    const inputs = publicInputs[proofType]?.[i] || {};
                    const verification = await this.zkProofs.verifier.verifyProof(proof, inputs);
                    results[proofType].push(verification);
                }
            }

            return results;
        } catch (error) {
            throw new Error(`Failed to verify proofs: ${error.message}`);
        }
    }

    /**
     * Get SDK status and health information
     * @returns {Promise<Object>} SDK status
     */
    async getStatus() {
        const status = {
            initialized: this.initialized,
            environment: this.config.environment,
            components: {
                storage: false,
                contracts: false,
                zkProofs: true
            },
            connectivity: {},
            version: '1.0.0'
        };

        try {
            if (this.storage) {
                status.connectivity.storage = await this.storage.storage.testConnectivity();
                status.components.storage = status.connectivity.storage.overall;
            }
            if (this.contracts) {
                status.components.contracts = true;
            }
            if (this.storage && status.components.storage) {
                status.storageStats = await this.storage.storage.getStorageStats();
            }
        } catch (error) {
            status.error = error.message;
        }

        return status;
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            profiler: profiler.generateReport(),
            storage: this.storage?.storage?.getCacheStats?.() || null,
            ipfs: this.storage?.ipfs?.getMetrics?.() || null,
            config: this.performanceConfig
        };
    }

    /**
     * Clean up SDK resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            if (this.performanceInterval) {
                clearInterval(this.performanceInterval);
            }
            if (this.storage?.storage) {
                await this.storage.storage.close();
            }
        } catch (error) {
            logger.warn('Error during SDK cleanup', { error: error.message });
        }
    }

    // Private helpers

    _ensureInitialized() {
        if (!this.initialized) {
            throw new Error('SDK not initialized. Call initialize() first.');
        }
    }

    _initializePerformanceMonitoring() {
        if (this.performanceConfig.profilingEnabled) {
            profiler.start('genetrust_sdk_session');
        }
        this.performanceInterval = setInterval(() => {
            const report = profiler.generateReport();
            if (report.profiles && report.profiles.length > 0) {
                logger.info('GeneTrust Performance Report', {
                    operations: report.summary.totalProfiles,
                    avgDuration: Math.round(report.summary.avgDuration),
                    slowestOp: report.slowestOperations[0]?.name
                });
            }
        }, 60000);
    }

    async _generateGenePresenceProofs(geneticData, requests = []) {
        if (!requests.length) return [];
        const generator = this.zkProofs.factory.createGenerator('gene-presence');
        const proofs = [];
        for (const request of requests) {
            const proof = await generator.generatePresenceProof(
                geneticData, request.targetGene, request.options
            );
            proofs.push(proof);
        }
        return proofs;
    }

    async _generateVariantProofs(geneticData, requests = []) {
        if (!requests.length) return [];
        const generator = this.zkProofs.factory.createGenerator('gene-variant');
        const proofs = [];
        for (const request of requests) {
            const proof = await generator.generateVariantProof(
                geneticData, request.targetVariant, request.options
            );
            proofs.push(proof);
        }
        return proofs;
    }

    async _generateAggregateProofs(geneticData, requests = []) {
        if (!requests.length) return [];
        const generator = this.zkProofs.factory.createGenerator('aggregate');
        const proofs = [];
        for (const request of requests) {
            const proof = await generator.generateAggregateProof(
                geneticData, request.aggregateQuery, request.options
            );
            proofs.push(proof);
        }
        return proofs;
    }

    async _registerOnBlockchain(storageResult, proofs, options = {}) {
        if (!this.contracts) return null;
        try {
            const dataResult = await this.contracts.geneticData.registerGeneticData({
                dataId: options.dataId || Math.floor(Math.random() * 1000000),
                price: options.price || 0,
                accessLevel: options.accessLevel || 3,
                metadataHash: storageResult.metadataHash || new Array(32).fill(0),
                storageUrl: storageResult.storageUrl,
                description: options.description || ''
            }, options.senderAddress);

            const proofResults = {};
            for (const [proofType, proofList] of Object.entries(proofs)) {
                proofResults[proofType] = [];
                for (const proof of proofList) {
                    const result = await this.contracts.verification.registerProof({
                        dataId: dataResult.dataId,
                        proofType: proof.proofType,
                        proofHash: proof.proofHash,
                        parameters: proof.parameters
                    }, options.senderAddress);
                    proofResults[proofType].push(result);
                }
            }

            return { data: dataResult, proofs: proofResults };
        } catch (error) {
            logger.warn('Blockchain registration failed', { error: error.message });
            return { error: error.message };
        }
    }

    async _setupCompliance(dataId, ownerAddress, options = {}) {
        if (!this.contracts?.compliance) return null;
        try {
            return await this.contracts.compliance.registerConsent({
                dataId,
                researchConsent: options.researchConsent !== false,
                commercialConsent: options.commercialConsent || false,
                clinicalConsent: options.clinicalConsent || false,
                jurisdiction: options.jurisdiction || 0,
                consentDuration: options.consentDuration || 8640
            }, ownerAddress);
        } catch (error) {
            logger.warn('Compliance setup failed', { error: error.message });
            return { error: error.message };
        }
    }

    async _verifyProofs(data, proofs) {
        return { verified: true, details: 'Proof verification not yet implemented' };
    }

    async _checkBlockchainPermissions(dataId, userAddress, accessLevel) {
        if (!this.contracts) return null;
        try {
            const hasAccess = await this.contracts.geneticData.verifyAccessRights(
                dataId, userAddress
            );
            return { hasAccess, accessLevel, checkedAt: Date.now() };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Create a new GeneTrust SDK instance
     * @param {Object} options - Configuration options
     * @returns {GeneTrust} SDK instance
     */
    static create(options = {}) {
        return new GeneTrust(options);
    }
}

export default GeneTrust;

// Named exports for individual modules
export { Phase2Config } from './config/phase2-config.js';
export { PerformanceConfig } from './config/performance-config.js';
export { ZKProofFactory, GenePresenceProofGenerator, GeneVariantProofGenerator, AggregateProofGenerator, ProofVerifier, ProofUtils } from './zk-proofs/index.js';
export { StorageFactory, StorageManager, EncryptionManager, IPFSClient } from './storage/index.js';
export { ContractFactory, GeneticDataClient, MarketplaceClient, VerificationClient, ComplianceClient } from './contracts/index.js';
export { CryptoUtils, DataFormatter, PerformanceProfiler, profiler } from './utils/index.js';
