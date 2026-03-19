import assert from 'node:assert/strict';
import { ZKProofFactory, ProofVerifier, ProofUtils } from '../src/zk-proofs/index.js';

const sampleData = {
  variants: [
    { gene: 'BRCA1', type: 'SNP', chromosome: '17', position: '41223094', allele: 'A', rsId: 'rs28897672' },
    { gene: 'APOE', type: 'SNP', chromosome: '19', position: '44908684', allele: 'T' },
    { gene: 'TP53', type: 'INDEL', chromosome: '17', position: '7674220', allele: 'G' },
  ],
  genes: [
    { symbol: 'BRCA1', name: 'Breast Cancer Gene 1', chromosome: '17' },
    { symbol: 'APOE', name: 'Apolipoprotein E', chromosome: '19' },
  ],
};

// ZKProofFactory – getSupportedTypes
{
  const types = ZKProofFactory.getSupportedTypes();
  assert.deepEqual(types, ['gene-presence', 'gene-variant', 'aggregate']);
  console.log('✓ ZKProofFactory.getSupportedTypes()');
}

// ZKProofFactory – createGenerator errors on unknown type
{
  assert.throws(() => ZKProofFactory.createGenerator('unknown'), /Unsupported proof type/);
  console.log('✓ ZKProofFactory.createGenerator() throws on unknown type');
}

// gene-presence proof – generate + verify locally
{
  const gen = ZKProofFactory.createGenerator('gene-presence');
  const proof = await gen.generatePresenceProof(sampleData, 'BRCA1');

  assert.equal(proof.proofType, 1);
  assert.ok(Array.isArray(proof.proofHash) && proof.proofHash.length === 32);
  assert.ok(Array.isArray(proof.parameters) && proof.parameters.length === 256);
  assert.equal(proof.metadata.targetGene, 'BRCA1');

  const ok = await gen.verifyProofLocally(proof, 'BRCA1');
  assert.ok(ok);

  const notOk = await gen.verifyProofLocally(proof, 'TP53');
  assert.ok(!notOk);

  console.log('✓ GenePresenceProofGenerator generate + verifyLocally');
}

// gene-presence proof – gene not found
{
  const gen = ZKProofFactory.createGenerator('gene-presence');
  await assert.rejects(
    () => gen.generatePresenceProof(sampleData, 'NONEXISTENT_GENE'),
    /not found/
  );
  console.log('✓ GenePresenceProofGenerator rejects missing gene');
}

// gene-variant proof – generate + verify locally
{
  const gen = ZKProofFactory.createGenerator('gene-variant');
  const targetVariant = { gene: 'BRCA1', type: 'SNP', rsId: 'rs28897672' };
  const proof = await gen.generateVariantProof(sampleData, targetVariant);

  assert.equal(proof.proofType, 3);
  assert.ok(Array.isArray(proof.proofHash) && proof.proofHash.length === 32);
  assert.ok(Array.isArray(proof.parameters) && proof.parameters.length === 256);

  const ok = await gen.verifyProofLocally(proof, targetVariant);
  assert.ok(ok);
  console.log('✓ GeneVariantProofGenerator generate + verifyLocally');
}

// gene-variant proof – invalid type rejected
{
  const gen = ZKProofFactory.createGenerator('gene-variant');
  await assert.rejects(
    () => gen.generateVariantProof(sampleData, { gene: 'BRCA1', type: 'INVALID' }),
    /Invalid variant type/
  );
  console.log('✓ GeneVariantProofGenerator rejects invalid variant type');
}

// gene-variant proof – multi-variant batch
{
  const gen = ZKProofFactory.createGenerator('gene-variant');
  const variants = [
    { gene: 'BRCA1', type: 'SNP' },
    { gene: 'APOE', type: 'SNP' },
  ];
  const proofs = await gen.generateMultiVariantProof(sampleData, variants);
  assert.equal(proofs.length, 2);
  console.log('✓ GeneVariantProofGenerator.generateMultiVariantProof()');
}

// aggregate proof – variant_count / count
{
  const gen = ZKProofFactory.createGenerator('aggregate');
  const query = { type: 'variant_count', statistic: 'count' };
  const proof = await gen.generateAggregateProof(sampleData, query);

  assert.equal(proof.proofType, 4);
  assert.ok(Array.isArray(proof.proofHash) && proof.proofHash.length === 32);

  const ok = await gen.verifyProofLocally(proof, query);
  assert.ok(ok);
  console.log('✓ AggregateProofGenerator variant_count/count');
}

// aggregate proof – gene_presence_count / percentage
{
  const gen = ZKProofFactory.createGenerator('aggregate');
  const query = { type: 'gene_presence_count', statistic: 'percentage', targetGenes: ['BRCA1', 'APOE'] };
  const proof = await gen.generateAggregateProof(sampleData, query);
  assert.equal(proof.proofType, 4);
  console.log('✓ AggregateProofGenerator gene_presence_count/percentage');
}

// aggregate proof – diversity_index / count
{
  const gen = ZKProofFactory.createGenerator('aggregate');
  const proof = await gen.generateAggregateProof(sampleData, { type: 'diversity_index', statistic: 'count' });
  assert.ok(proof);
  console.log('✓ AggregateProofGenerator diversity_index');
}

// aggregate proof – invalid type rejected
{
  const gen = ZKProofFactory.createGenerator('aggregate');
  await assert.rejects(
    () => gen.generateAggregateProof(sampleData, { type: 'bad_type', statistic: 'count' }),
    /Invalid query type/
  );
  console.log('✓ AggregateProofGenerator rejects invalid query type');
}

// ProofVerifier – verifyProof via factory
{
  const verifier = ZKProofFactory.createVerifier();

  // gene-presence
  const presenceGen = ZKProofFactory.createGenerator('gene-presence');
  const presenceProof = await presenceGen.generatePresenceProof(sampleData, 'BRCA1');
  const presenceResult = await verifier.verifyProof(presenceProof, { targetGene: 'BRCA1' });
  assert.ok(presenceResult.valid);
  console.log('✓ ProofVerifier.verifyProof(gene-presence)');

  // gene-variant
  const variantGen = ZKProofFactory.createGenerator('gene-variant');
  const variantProof = await variantGen.generateVariantProof(sampleData, { gene: 'BRCA1', type: 'SNP' });
  const variantResult = await verifier.verifyProof(variantProof, { targetVariant: { gene: 'BRCA1', type: 'SNP' } });
  assert.ok(variantResult.valid);
  console.log('✓ ProofVerifier.verifyProof(gene-variant)');

  // aggregate
  const aggGen = ZKProofFactory.createGenerator('aggregate');
  const aggProof = await aggGen.generateAggregateProof(sampleData, { type: 'variant_count', statistic: 'count' });
  const aggResult = await verifier.verifyProof(aggProof, { aggregateQuery: { type: 'variant_count', statistic: 'count' } });
  assert.ok(aggResult.valid);
  console.log('✓ ProofVerifier.verifyProof(aggregate)');
}

// ProofVerifier – batchVerifyProofs
{
  const verifier = ZKProofFactory.createVerifier();
  const gen = ZKProofFactory.createGenerator('gene-presence');
  const p1 = await gen.generatePresenceProof(sampleData, 'BRCA1');
  const p2 = await gen.generatePresenceProof(sampleData, 'APOE');
  const results = await verifier.batchVerifyProofs([p1, p2], [{}, {}]);
  assert.equal(results.length, 2);
  assert.ok(results[0].valid);
  assert.ok(results[1].valid);
  const stats = verifier.getVerificationStats(results);
  assert.equal(stats.total, 2);
  assert.equal(stats.valid, 2);
  console.log('✓ ProofVerifier.batchVerifyProofs()');
}

// ProofVerifier – rejects malformed proof
{
  const verifier = ZKProofFactory.createVerifier();
  const result = await verifier.verifyProof({ proofType: 1 }, {});
  assert.ok(!result.valid);
  console.log('✓ ProofVerifier rejects malformed proof');
}

// ProofUtils
{
  const buf = ProofUtils.stringToFixedBuffer('BRCA1', 32);
  assert.equal(buf.length, 32);

  const arr = ProofUtils.bufferToArray(buf);
  assert.equal(arr.length, 32);

  const back = ProofUtils.arrayToBuffer(arr);
  assert.deepEqual(back, buf);

  const nonce = ProofUtils.generateNonce(16);
  assert.equal(nonce.length, 16);

  const root = ProofUtils.createMerkleRoot(['a', 'b', 'c']);
  assert.equal(root.length, 32);

  const { commitment, nonce: cn, dataHash } = ProofUtils.createCommitment('test-value');
  assert.ok(ProofUtils.verifyCommitment('test-value', cn, commitment));

  const formatted = ProofUtils.formatForContract({ key: 'val' });
  assert.equal(formatted.length, 256);

  const parsed = ProofUtils.parseFromContract(formatted);
  assert.deepEqual(parsed, { key: 'val' });

  const validation = ProofUtils.validateGeneticData(sampleData);
  assert.ok(validation.valid);

  const badValidation = ProofUtils.validateGeneticData({});
  assert.ok(!badValidation.valid);

  const meta = ProofUtils.generateProofMetadata('gene-presence', { version: '2.0.0' });
  assert.equal(meta.version, '2.0.0');

  const entropy = ProofUtils.calculateEntropy(Buffer.from('hello world test data'));
  assert.ok(entropy > 0);

  const dataId = ProofUtils.generateDataId(sampleData, 'SP1ABC');
  assert.equal(dataId.length, 32);

  console.log('✓ ProofUtils – all helpers');
}

console.log('\n✅ zk-proofs tests passed');
