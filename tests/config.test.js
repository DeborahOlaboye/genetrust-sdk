import assert from 'node:assert/strict';
import { Phase2Config, PerformanceConfig } from '../src/config/phase2-config.js';

// Phase2Config – fromEnvironment
{
  const config = Phase2Config.fromEnvironment();
  assert.ok(config, 'Phase2Config instance created');
  assert.ok(config.environment, 'environment set');
  assert.ok(config.getIPFSConfig(), 'IPFS config accessible');
  assert.ok(config.getEncryptionConfig(), 'encryption config accessible');
  assert.ok(config.getZKProofConfig(), 'ZK proof config accessible');
  assert.ok(config.getContractConfig(), 'contract config accessible');
  console.log('✓ Phase2Config.fromEnvironment()');
}

// Phase2Config – forEnvironment variants
for (const env of ['development', 'testing', 'staging', 'production']) {
  const config = Phase2Config.forEnvironment(env);
  assert.equal(config.environment, env);
  const validation = config.validateConfig();
  assert.equal(typeof validation.valid, 'boolean');
  console.log(`✓ Phase2Config.forEnvironment('${env}')`);
}

// Phase2Config – setContractAddresses
{
  const config = Phase2Config.fromEnvironment();
  config.setContractAddresses({ geneticData: { address: 'SP123', name: 'genetic-data' } });
  const addresses = config.getContractConfig().addresses;
  assert.equal(addresses.geneticData.address, 'SP123');
  console.log('✓ Phase2Config.setContractAddresses()');
}

// Phase2Config – exportConfig / importConfig round-trip
{
  const config = Phase2Config.fromEnvironment();
  const json = config.exportConfig(false);
  const config2 = Phase2Config.fromEnvironment();
  config2.importConfig(json, false);
  assert.ok(config2.getIPFSConfig());
  console.log('✓ Phase2Config exportConfig / importConfig round-trip');
}

// Phase2Config – getFeatureFlags
{
  const config = Phase2Config.fromEnvironment();
  const flags = config.getFeatureFlags();
  assert.ok(typeof flags.enableZKProofs === 'boolean');
  assert.ok(typeof flags.enableMarketplace === 'boolean');
  console.log('✓ Phase2Config.getFeatureFlags()');
}

// Phase2Config – updateConfig
{
  const config = Phase2Config.fromEnvironment();
  config.updateConfig('ipfs', { host: '127.0.0.1' });
  assert.equal(config.getIPFSConfig().host, '127.0.0.1');
  console.log('✓ Phase2Config.updateConfig()');
}

// PerformanceConfig – getConfig
{
  for (const env of ['development', 'testing', 'production']) {
    const cfg = PerformanceConfig.getConfig(env);
    assert.ok(cfg.chunkSize > 0);
    assert.ok(cfg.cacheSize > 0);
    console.log(`✓ PerformanceConfig.getConfig('${env}')`);
  }
}

// PerformanceConfig – optimizeForDataset
{
  for (const size of [100, 5000, 50000, 500000]) {
    const cfg = PerformanceConfig.optimizeForDataset(size);
    assert.ok(cfg.chunkSize > 0);
    console.log(`✓ PerformanceConfig.optimizeForDataset(${size})`);
  }
}

console.log('\n✅ config tests passed');
