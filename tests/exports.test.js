// Smoke-test: verify all documented exports resolve from the installed package
import assert from 'node:assert/strict';

// Main entry
import {
  GeneTrust,
  Phase2Config,
  PerformanceConfig,
  ZKProofFactory,
  GenePresenceProofGenerator,
  GeneVariantProofGenerator,
  AggregateProofGenerator,
  ProofVerifier,
  ProofUtils,
  StorageFactory,
  StorageManager,
  EncryptionManager,
  IPFSClient,
  ContractFactory,
  GeneticDataClient,
  MarketplaceClient,
  VerificationClient,
  ComplianceClient,
  CryptoUtils,
  DataFormatter,
  PerformanceProfiler,
  profiler,
} from '../src/index.js';

// Every named export must be defined
const exports = {
  GeneTrust,
  Phase2Config,
  PerformanceConfig,
  ZKProofFactory,
  GenePresenceProofGenerator,
  GeneVariantProofGenerator,
  AggregateProofGenerator,
  ProofVerifier,
  ProofUtils,
  StorageFactory,
  StorageManager,
  EncryptionManager,
  IPFSClient,
  ContractFactory,
  GeneticDataClient,
  MarketplaceClient,
  VerificationClient,
  ComplianceClient,
  CryptoUtils,
  DataFormatter,
  PerformanceProfiler,
  profiler,
};

for (const [name, value] of Object.entries(exports)) {
  assert.ok(value !== undefined && value !== null, `${name} must be exported`);
  console.log(`✓ export: ${name}`);
}

// GeneTrust.create() returns an instance
const sdk = GeneTrust.create();
assert.ok(sdk instanceof GeneTrust);
assert.ok(typeof sdk.storeGeneticData === 'function');
assert.ok(typeof sdk.retrieveGeneticData === 'function');
assert.ok(typeof sdk.createMarketplaceListing === 'function');
assert.ok(typeof sdk.purchaseGeneticData === 'function');
assert.ok(typeof sdk.generateProofs === 'function');
assert.ok(typeof sdk.verifyProofs === 'function');
assert.ok(typeof sdk.getStatus === 'function');
assert.ok(typeof sdk.cleanup === 'function');
console.log('✓ GeneTrust.create() instance has all methods');

console.log('\n✅ exports smoke-test passed');
