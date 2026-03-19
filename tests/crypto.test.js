import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { CryptoUtils } from '../src/utils/crypto-utils.js';

// generateSecureKey
{
  const hexKey = CryptoUtils.generateSecureKey(32, 'hex');
  assert.equal(hexKey.length, 64, 'hex key is 64 chars');

  const b64Key = CryptoUtils.generateSecureKey(16, 'base64');
  assert.ok(b64Key.length > 0);

  const bufKey = CryptoUtils.generateSecureKey(32, 'buffer');
  assert.equal(bufKey.length, 32);
  console.log('✓ CryptoUtils.generateSecureKey()');
}

// generateHash
{
  const h1 = CryptoUtils.generateHash('hello', 'hex');
  const h2 = CryptoUtils.generateHash('hello', 'hex');
  assert.equal(h1, h2, 'same input → same hash');
  assert.equal(h1.length, 64);

  const h3 = CryptoUtils.generateHash('world', 'hex');
  assert.notEqual(h1, h3);
  console.log('✓ CryptoUtils.generateHash()');
}

// generateHMAC + verifyHMAC
{
  const data = 'genetic-data-payload';
  const key = 'secret-key';
  const hmac = CryptoUtils.generateHMAC(data, key, 'sha256', 'hex');
  assert.equal(hmac.length, 64);
  assert.ok(CryptoUtils.verifyHMAC(data, key, hmac));
  assert.ok(!CryptoUtils.verifyHMAC('tampered', key, hmac));
  console.log('✓ CryptoUtils.generateHMAC / verifyHMAC');
}

// generateSalt
{
  const salt = CryptoUtils.generateSalt(16, 'hex');
  assert.equal(salt.length, 32);
  const salt2 = CryptoUtils.generateSalt(16, 'hex');
  assert.notEqual(salt, salt2, 'salts are random');
  console.log('✓ CryptoUtils.generateSalt()');
}

// deriveKey
{
  const key = CryptoUtils.deriveKey('password', 'salt', 1000, 32, 'sha256');
  assert.equal(key.length, 32);
  const key2 = CryptoUtils.deriveKey('password', 'salt', 1000, 32, 'sha256');
  assert.deepEqual(key, key2, 'PBKDF2 is deterministic');
  console.log('✓ CryptoUtils.deriveKey()');
}

// generateCombinedHash
{
  const h = CryptoUtils.generateCombinedHash(['a', 'b', 'c']);
  assert.equal(h.length, 64);
  console.log('✓ CryptoUtils.generateCombinedHash()');
}

// createDataFingerprint
{
  const data = { variants: [{ type: 'SNP', gene: 'BRCA1' }], genes: [] };
  const fp = CryptoUtils.createDataFingerprint(data);
  assert.equal(typeof fp, 'string');
  assert.equal(fp.length, 64);
  console.log('✓ CryptoUtils.createDataFingerprint()');
}

// generateDatasetId
{
  const id = CryptoUtils.generateDatasetId('SP1ABC', { name: 'test' }, 1000);
  assert.equal(id.length, 16);
  console.log('✓ CryptoUtils.generateDatasetId()');
}

// validateDataIntegrity
{
  const data = { key: 'value' };
  const checksum = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  assert.ok(CryptoUtils.validateDataIntegrity(data, checksum));
  assert.ok(!CryptoUtils.validateDataIntegrity({ key: 'other' }, checksum));
  console.log('✓ CryptoUtils.validateDataIntegrity()');
}

// generateNonce
{
  const n1 = CryptoUtils.generateNonce(16, true);
  const n2 = CryptoUtils.generateNonce(16, true);
  assert.notEqual(n1, n2);
  console.log('✓ CryptoUtils.generateNonce()');
}

// createCommitment + verifyCommitment
{
  const value = 'gene-BRCA1';
  const { commitment, nonce } = CryptoUtils.createCommitment(value);
  assert.ok(CryptoUtils.verifyCommitment(commitment, value, nonce));
  assert.ok(!CryptoUtils.verifyCommitment(commitment, 'wrong', nonce));
  console.log('✓ CryptoUtils.createCommitment / verifyCommitment');
}

// generateMerkleRoot
{
  const root = CryptoUtils.generateMerkleRoot(['a', 'b', 'c', 'd']);
  assert.equal(typeof root, 'string');
  assert.equal(root.length, 64);
  const rootSingle = CryptoUtils.generateMerkleRoot(['only']);
  assert.equal(rootSingle, 'only');
  console.log('✓ CryptoUtils.generateMerkleRoot()');
}

// encryptAESGCM + decryptAESGCM round-trip
{
  const key = CryptoUtils.generateSecureKey(32, 'buffer');
  const plaintext = 'sensitive genetic data 🧬';
  const encrypted = CryptoUtils.encryptAESGCM(plaintext, key);
  const decrypted = CryptoUtils.decryptAESGCM(encrypted, key);
  assert.equal(decrypted, plaintext);
  console.log('✓ CryptoUtils encryptAESGCM / decryptAESGCM round-trip');
}

// generateApiKey + validateApiKeyFormat
{
  const key = CryptoUtils.generateApiKey(32, 'gc');
  assert.ok(key.startsWith('gc_'));
  assert.ok(CryptoUtils.validateApiKeyFormat(key, 'gc'));
  assert.ok(!CryptoUtils.validateApiKeyFormat('bad', 'gc'));
  console.log('✓ CryptoUtils.generateApiKey / validateApiKeyFormat');
}

// calculateEntropy
{
  const entropy = CryptoUtils.calculateEntropy(Buffer.from('hello world'));
  assert.ok(entropy > 0);
  console.log('✓ CryptoUtils.calculateEntropy()');
}

// signData + verifySignature
{
  const payload = { dataId: 42, owner: 'SP1ABC' };
  const privateKey = 'my-private-key';
  const sig = CryptoUtils.signData(payload, privateKey);
  assert.ok(CryptoUtils.verifySignature(payload, sig, privateKey));
  assert.ok(!CryptoUtils.verifySignature(payload, sig, 'wrong-key'));
  console.log('✓ CryptoUtils.signData / verifySignature');
}

console.log('\n✅ crypto tests passed');
