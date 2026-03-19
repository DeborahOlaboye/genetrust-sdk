// Orchestration layer for genetic data storage and retrieval
// Combines IPFS storage with encryption for complete data management

import { IPFSClient } from './ipfs-client.js';
import { EncryptionManager } from './encryption.js';
import { ProofUtils } from '../zk-proofs/utils/proof-utils.js';
import { profiler } from '../utils/performance-profiler.js';

export class StorageManager {
    constructor(options = {}) {
        this.config = {
            ipfsConfig: options.ipfs || {},
            encryptionConfig: options.encryption || {},
            defaultAccessLevel: options.defaultAccessLevel || 1,
            autoPin: options.autoPin !== false,
            compressionEnabled: options.compressionEnabled !== false,
            cacheEnabled: options.cacheEnabled !== false,
            cacheSize: options.cacheSize || 100,
            batchSize: options.batchSize || 10,
            ...options
        };

        this.ipfsClient = new IPFSClient(this.config.ipfsConfig);
        this.encryptionManager = new EncryptionManager(this.config.encryptionConfig);
        this.storedDatasets = new Map();
        this.dataCache = new Map();
        this.metadataCache = new Map();
        this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
        this.batchQueue = [];
        this.batchTimer = null;
    }

    async storeGeneticData(geneticData, password, options = {}) {
        const dataSize = JSON.stringify(geneticData).length;
        profiler.start('storeGeneticData', { dataSize, ownerAddress: options.ownerAddress });

        try {
            profiler.checkpoint('storeGeneticData', 'validating_data');
            const validation = ProofUtils.validateGeneticData(geneticData);
            if (!validation.valid) {
                throw new Error(`Invalid genetic data: ${validation.errors.join(', ')}`);
            }

            const datasetId = options.datasetId || ProofUtils.generateDataId(geneticData, options.ownerAddress || 'anonymous');

            if (this.config.cacheEnabled && this._isCached(datasetId)) {
                profiler.end('storeGeneticData');
                return this._getCachedResult(datasetId);
            }

            const accessConfig = {
                customTiers: options.customTiers,
                accessLevels: options.accessLevels || [1, 2, 3]
            };

            profiler.checkpoint('storeGeneticData', 'encrypting_data');
            const encryptedPackage = await this.encryptionManager.encryptGeneticData(
                geneticData,
                password,
                accessConfig
            );

            profiler.checkpoint('storeGeneticData', 'preparing_metadata');
            const metadata = {
                datasetId,
                ownerAddress: options.ownerAddress,
                createdAt: Date.now(),
                accessLevels: accessConfig.accessLevels,
                dataTypes: Object.keys(geneticData),
                encryptionVersion: '1.0.0',
                compressionUsed: this.config.compressionEnabled,
                totalSize: dataSize,
                checksum: encryptedPackage.checksum
            };

            profiler.checkpoint('storeGeneticData', 'compressing_data');
            let finalData = Buffer.from(JSON.stringify(encryptedPackage));
            if (this.config.compressionEnabled) {
                finalData = await this._compressData(finalData);
                metadata.compressed = true;
            }

            profiler.checkpoint('storeGeneticData', 'uploading_to_ipfs');
            const ipfsResult = await this.ipfsClient.uploadGeneticData(finalData, metadata, {
                pin: this.config.autoPin,
                onProgress: options.onProgress
            });

            const accessUrls = {};
            for (const level of accessConfig.accessLevels) {
                accessUrls[level] = ipfsResult.storageUrl;
            }

            const datasetInfo = {
                datasetId,
                ipfsHash: ipfsResult.ipfsHash,
                storageUrl: ipfsResult.storageUrl,
                accessUrls,
                metadata: ipfsResult.metadata,
                storedAt: Date.now(),
                encryptionInfo: {
                    accessLevels: accessConfig.accessLevels,
                    masterSalt: encryptedPackage.masterSalt
                }
            };

            this.storedDatasets.set(datasetId, datasetInfo);

            const result = {
                success: true,
                datasetId,
                storageUrl: ipfsResult.storageUrl,
                ipfsHash: ipfsResult.ipfsHash,
                accessUrls,
                size: ipfsResult.size,
                accessLevels: accessConfig.accessLevels,
                metadata,
                encryptedAt: Date.now()
            };

            if (this.config.cacheEnabled) this._cacheResult(datasetId, result);

            profiler.end('storeGeneticData');
            return result;
        } catch (error) {
            profiler.end('storeGeneticData');
            throw new Error(`Storage failed: ${error.message}`);
        }
    }

    async retrieveGeneticData(storageUrl, password, accessLevel = 1, options = {}) {
        const cacheKey = `${storageUrl}_${accessLevel}`;
        profiler.start('retrieveGeneticData', { storageUrl, accessLevel });

        try {
            if (this.config.cacheEnabled && this.dataCache.has(cacheKey)) {
                this.cacheStats.hits++;
                profiler.end('retrieveGeneticData');
                return this.dataCache.get(cacheKey);
            }

            this.cacheStats.misses++;

            profiler.checkpoint('retrieveGeneticData', 'fetching_from_ipfs');
            const ipfsResult = await this.ipfsClient.retrieveGeneticData(storageUrl);

            profiler.checkpoint('retrieveGeneticData', 'decompressing_data');
            let encryptedPackage;
            if (ipfsResult.metadata && ipfsResult.metadata.compressed) {
                const decompressedData = await this._decompressData(ipfsResult.data);
                encryptedPackage = JSON.parse(decompressedData.toString());
            } else {
                encryptedPackage = JSON.parse(ipfsResult.data.toString());
            }

            profiler.checkpoint('retrieveGeneticData', 'decrypting_data');
            const decryptedResult = await this.encryptionManager.decryptGeneticData(
                encryptedPackage,
                password,
                accessLevel
            );

            profiler.checkpoint('retrieveGeneticData', 'verifying_integrity');
            if (ipfsResult.metadata && ipfsResult.metadata.checksum) {
                const isIntact = this.encryptionManager.verifyIntegrity(
                    decryptedResult.data,
                    ipfsResult.metadata.checksum
                );
                if (!isIntact && options.strictIntegrity !== false) {
                    throw new Error('Data integrity check failed');
                }
                decryptedResult.integrityVerified = isIntact;
            }

            const result = {
                success: true,
                data: decryptedResult.data,
                accessLevel: decryptedResult.accessLevel,
                metadata: {
                    ...decryptedResult.metadata,
                    ipfsMetadata: ipfsResult.metadata,
                    retrievedFrom: storageUrl,
                    retrievedAt: Date.now()
                }
            };

            if (this.config.cacheEnabled) this._cacheData(cacheKey, result);

            profiler.end('retrieveGeneticData');
            return result;
        } catch (error) {
            profiler.end('retrieveGeneticData');
            throw new Error(`Retrieval failed: ${error.message}`);
        }
    }

    async generateAccessToken(datasetId, password, accessLevel, options = {}) {
        try {
            const datasetInfo = this.storedDatasets.get(datasetId);
            if (!datasetInfo) throw new Error(`Dataset not found: ${datasetId}`);

            const ipfsResult = await this.ipfsClient.retrieveGeneticData(datasetInfo.storageUrl);
            let encryptedPackage;
            if (ipfsResult.metadata && ipfsResult.metadata.compressed) {
                const decompressedData = await this._decompressData(ipfsResult.data);
                encryptedPackage = JSON.parse(decompressedData.toString());
            } else {
                encryptedPackage = JSON.parse(ipfsResult.data.toString());
            }

            const accessToken = await this.encryptionManager.generateAccessKey(
                encryptedPackage,
                password,
                accessLevel,
                options.recipientPublicKey
            );

            return {
                success: true,
                datasetId,
                accessToken,
                storageUrl: datasetInfo.storageUrl,
                validUntil: accessToken.validUntil,
                accessLevel
            };
        } catch (error) {
            throw new Error(`Access token generation failed: ${error.message}`);
        }
    }

    listStoredDatasets(filters = {}) {
        const datasets = Array.from(this.storedDatasets.values());
        let filtered = datasets;
        if (filters.ownerAddress) filtered = filtered.filter(d => d.metadata.ownerAddress === filters.ownerAddress);
        if (filters.accessLevel) filtered = filtered.filter(d => d.encryptionInfo.accessLevels.includes(filters.accessLevel));
        if (filters.dataTypes) filtered = filtered.filter(d => filters.dataTypes.every(type => d.metadata.dataTypes.includes(type)));
        if (filters.createdAfter) filtered = filtered.filter(d => d.storedAt > filters.createdAfter);
        return filtered.map(dataset => ({
            datasetId: dataset.datasetId,
            storageUrl: dataset.storageUrl,
            accessLevels: dataset.encryptionInfo.accessLevels,
            dataTypes: dataset.metadata.dataTypes,
            storedAt: dataset.storedAt,
            size: dataset.metadata.totalSize
        }));
    }

    async deleteDataset(datasetId, unpinFromIPFS = true) {
        try {
            const datasetInfo = this.storedDatasets.get(datasetId);
            if (!datasetInfo) throw new Error(`Dataset not found: ${datasetId}`);
            if (unpinFromIPFS) await this.ipfsClient.unpinContent(datasetInfo.ipfsHash);
            this.storedDatasets.delete(datasetId);
            return true;
        } catch (error) {
            throw new Error(`Dataset deletion failed: ${error.message}`);
        }
    }

    async getStorageStats() {
        try {
            const ipfsStats = await this.ipfsClient.getStorageStats();
            const localDatasets = this.storedDatasets.size;
            return {
                ipfsStats,
                localDatasets,
                totalDatasets: localDatasets,
                datasetsById: Array.from(this.storedDatasets.keys())
            };
        } catch (error) {
            throw new Error(`Failed to get storage stats: ${error.message}`);
        }
    }

    async testConnectivity() {
        try {
            const ipfsConnected = await this.ipfsClient.testConnection();
            return { ipfs: ipfsConnected, overall: ipfsConnected, timestamp: Date.now() };
        } catch (error) {
            return { ipfs: false, overall: false, error: error.message, timestamp: Date.now() };
        }
    }

    exportDatasetInfo(datasetId) {
        const datasetInfo = this.storedDatasets.get(datasetId);
        if (!datasetInfo) throw new Error(`Dataset not found: ${datasetId}`);
        return {
            datasetId: datasetInfo.datasetId,
            ipfsHash: datasetInfo.ipfsHash,
            storageUrl: datasetInfo.storageUrl,
            accessLevels: datasetInfo.encryptionInfo.accessLevels,
            metadata: { ...datasetInfo.metadata, masterSalt: undefined },
            exportedAt: Date.now()
        };
    }

    importDatasetInfo(datasetInfo) {
        if (!datasetInfo.datasetId || !datasetInfo.storageUrl) {
            throw new Error('Invalid dataset information for import');
        }
        this.storedDatasets.set(datasetInfo.datasetId, { ...datasetInfo, importedAt: Date.now() });
    }

    async batchStoreGeneticData(datasets) {
        profiler.start('batchStoreGeneticData', { count: datasets.length });
        try {
            const results = [];
            const batchSize = this.config.batchSize;
            for (let i = 0; i < datasets.length; i += batchSize) {
                const batch = datasets.slice(i, i + batchSize);
                const batchPromises = batch.map(({ geneticData, password, options }) =>
                    this.storeGeneticData(geneticData, password, options)
                );
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                if (i + batchSize < datasets.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            profiler.end('batchStoreGeneticData');
            return results;
        } catch (error) {
            profiler.end('batchStoreGeneticData');
            throw new Error(`Batch storage failed: ${error.message}`);
        }
    }

    getCacheStats() {
        const hitRate = this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0;
        return {
            ...this.cacheStats,
            hitRate: Math.round(hitRate * 100) / 100,
            dataCache: this.dataCache.size,
            metadataCache: this.metadataCache.size,
            totalCached: this.dataCache.size + this.metadataCache.size
        };
    }

    clearCache() {
        this.dataCache.clear();
        this.metadataCache.clear();
        this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    }

    async close() {
        try {
            await this.ipfsClient.close();
            this.storedDatasets.clear();
            this.clearCache();
            if (this.batchTimer) clearTimeout(this.batchTimer);
        } catch (error) {
            console.warn('Error closing storage manager:', error.message);
        }
    }

    async _compressData(data) { return data; }
    async _decompressData(data) { return data; }

    _isCached(datasetId) {
        return this.dataCache.has(datasetId) || this.metadataCache.has(datasetId);
    }

    _getCachedResult(datasetId) {
        this.cacheStats.hits++;
        return this.dataCache.get(datasetId) || this.metadataCache.get(datasetId);
    }

    _cacheResult(datasetId, result) {
        this._evictIfNeeded();
        this.metadataCache.set(datasetId, result);
    }

    _cacheData(cacheKey, data) {
        this._evictIfNeeded();
        this.dataCache.set(cacheKey, data);
    }

    _evictIfNeeded() {
        const totalCacheSize = this.dataCache.size + this.metadataCache.size;
        if (totalCacheSize >= this.config.cacheSize) {
            const oldestDataKey = this.dataCache.keys().next().value;
            const oldestMetaKey = this.metadataCache.keys().next().value;
            if (oldestDataKey) { this.dataCache.delete(oldestDataKey); this.cacheStats.evictions++; }
            if (oldestMetaKey) { this.metadataCache.delete(oldestMetaKey); this.cacheStats.evictions++; }
        }
    }
}
