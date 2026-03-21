/**
 * GeneTrust SDK — Node.js demo
 *
 * Demonstrates SDK instantiation, configuration, ZK proof generation,
 * and crypto utilities without requiring a live Stacks node or IPFS daemon.
 *
 * Run:
 *   cd examples && npm install && node demo.js
 */

import { GeneTrust, VERSION } from 'genetrust-sdk';
import { ZKProofFactory } from 'genetrust-sdk/zk-proofs';
import { CryptoUtils } from 'genetrust-sdk/utils';
import { Phase2Config } from 'genetrust-sdk/config';

console.log(`GeneTrust SDK v${VERSION}\n`);

// ── 1. Configuration ──────────────────────────────────────────────────────────
const config = Phase2Config.forEnvironment('development');
console.log('Environment:', config.environment);
console.log('Feature flags:', config.getFeatureFlags());

// ── 2. SDK instance ───────────────────────────────────────────────────────────
const sdk = GeneTrust.create({ config });
console.log('\nSDK version:', sdk.getVersion());

// ── 3. Crypto utilities ───────────────────────────────────────────────────────
const key = CryptoUtils.generateSecureKey(32);
const hash = CryptoUtils.generateHash('BRCA1-variant-data');
const nonce = CryptoUtils.generateNonce();
console.log('\nCrypto utilities:');
console.log('  Secure key (hex):', key.toString('hex').slice(0, 16) + '…');
console.log('  Hash:', hash.slice(0, 16) + '…');
console.log('  Nonce:', nonce.slice(0, 16) + '…');

// ── 4. ZK proof generation ────────────────────────────────────────────────────
const sampleData = {
  genes: ['BRCA1', 'BRCA2', 'TP53'],
  variants: [
    { gene: 'BRCA1', chromosome: '17', position: 43094692, ref: 'A', alt: 'G', rsid: 'rs80357382' },
    { gene: 'TP53', chromosome: '17', position: 7572837, ref: 'C', alt: 'T', rsid: 'rs28934578' },
  ],
};

console.log('\nGenerating gene-presence proof for BRCA1…');
const generator = ZKProofFactory.createGenerator('gene-presence');
const proof = await generator.generatePresenceProof(sampleData, 'BRCA1');
console.log('  Proof type:', proof.proofType);
console.log('  Valid:', proof.valid);
console.log('  Commitment:', proof.commitment?.slice(0, 16) + '…');

const verifier = ZKProofFactory.createVerifier();
const result = await verifier.verifyProof(proof, { targetGene: 'BRCA1' });
console.log('\nVerification result:', result.valid ? 'PASS ✓' : 'FAIL ✗');

console.log('\nDemo complete.');
