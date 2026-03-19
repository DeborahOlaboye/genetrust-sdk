import assert from 'node:assert/strict';
import { DataFormatter } from '../src/utils/data-formatter.js';

const sampleData = {
  variants: [
    { chromosome: 'chr17', position: '41223094', reference: 'A', alternate: 'T', gene: 'BRCA1', type: 'SNP', quality: 99 },
    { chromosome: '19', position: 44908684, reference: 'C', alternate: 'T', gene: 'APOE' },
  ],
  genes: [
    { symbol: 'BRCA1', full_name: 'Breast Cancer Gene 1', chromosome: 'chr17', start: 43044295, end: 43125483 },
  ],
  sequences: [
    { id: 'seq1', type: 'DNA', sequence: 'ATCGATCG', description: 'test sequence' },
  ],
  phenotypes: [
    { trait: 'height', value: 175, unit: 'cm', category: 'quantitative' },
  ],
};

// formatForStorage
{
  const formatted = await DataFormatter.formatForStorage(sampleData);
  assert.ok(formatted.variants, 'variants present');
  assert.ok(Array.isArray(formatted.variants));
  assert.ok(formatted.genes);
  assert.ok(formatted.sequences);
  assert.ok(formatted.metadata);
  assert.equal(formatted.formatVersion, '1.0.0');

  // chromosome normalisation
  const v = formatted.variants[0];
  assert.equal(v.chromosome, '17', 'chr17 → 17');
  assert.equal(v.type, 'SNP');
  console.log('✓ DataFormatter.formatForStorage()');
}

// formatForStorage – removeEmpty
{
  const minimal = { variants: [{ chromosome: '1', position: '100', reference: 'A', alternate: 'T' }] };
  const formatted = await DataFormatter.formatForStorage(minimal, { removeEmpty: true });
  assert.ok(!formatted.sequences || formatted.sequences.length > 0 || !('sequences' in formatted));
  console.log('✓ DataFormatter.formatForStorage({ removeEmpty: true })');
}

// formatForContract – marketplace
{
  const listing = {
    listingId: 42,
    price: 1000000,
    dataId: 7,
    accessLevel: 2,
    requiresVerification: true,
    metadataHash: new Array(32).fill(0),
  };
  const formatted = DataFormatter.formatForContract(listing, 'marketplace');
  assert.equal(formatted.listingId, 42);
  assert.equal(formatted.price, 1000000);
  assert.equal(formatted.accessLevel, 2);
  console.log('✓ DataFormatter.formatForContract(marketplace)');
}

// formatForContract – genetic-data
{
  const data = { id: 10, price: 500, accessLevel: 3, storageUrl: 'ipfs://abc', description: 'test' };
  const formatted = DataFormatter.formatForContract(data, 'genetic-data');
  assert.equal(formatted.dataId, 10);
  assert.ok(formatted.storageUrl.length <= 256);
  console.log('✓ DataFormatter.formatForContract(genetic-data)');
}

// formatForContract – verification
{
  const proof = { dataId: 1, proofType: 1, proofHash: new Array(32).fill(0), parameters: new Array(256).fill(0) };
  const formatted = DataFormatter.formatForContract(proof, 'verification');
  assert.equal(formatted.dataId, 1);
  console.log('✓ DataFormatter.formatForContract(verification)');
}

// formatForContract – compliance
{
  const consent = { dataId: 5, researchConsent: true, jurisdiction: 1, consentDuration: 8640 };
  const formatted = DataFormatter.formatForContract(consent, 'compliance');
  assert.ok(formatted.researchConsent);
  console.log('✓ DataFormatter.formatForContract(compliance)');
}

// formatForContract – unknown type throws
{
  assert.throws(() => DataFormatter.formatForContract({}, 'unknown'), /Unsupported contract format/);
  console.log('✓ DataFormatter.formatForContract throws on unknown type');
}

// toVCF + fromVCF round-trip
{
  const vcf = DataFormatter.toVCF(sampleData);
  assert.ok(vcf.includes('##fileformat=VCFv4.2'));
  assert.ok(vcf.includes('#CHROM'));

  const parsed = DataFormatter.fromVCF(vcf);
  assert.ok(Array.isArray(parsed.variants));
  console.log('✓ DataFormatter toVCF / fromVCF round-trip');
}

// toFASTA + fromFASTA round-trip
{
  const fasta = DataFormatter.toFASTA(sampleData);
  assert.ok(fasta.includes('>seq1'));
  assert.ok(fasta.includes('ATCGATCG'));

  const parsed = DataFormatter.fromFASTA(fasta);
  assert.equal(parsed.sequences.length, 1);
  assert.equal(parsed.sequences[0].sequence, 'ATCGATCG');
  console.log('✓ DataFormatter toFASTA / fromFASTA round-trip');
}

// toJSONLD
{
  const jsonld = DataFormatter.toJSONLD(sampleData);
  assert.ok(jsonld['@context']);
  assert.equal(jsonld['@type'], 'genetics:GeneticDataset');
  console.log('✓ DataFormatter.toJSONLD()');
}

// standardizeVariant
{
  const variant = { chromosome: '17', position: 100, reference: 'A', alternate: 'T' };
  const minimal = DataFormatter.standardizeVariant(variant, 'minimal');
  assert.equal(minimal.chr, '17');
  assert.equal(minimal.type, 'SNP');

  const vcfVariant = DataFormatter.standardizeVariant(variant, 'vcf');
  assert.equal(vcfVariant.CHROM, '17');

  const hgvs = DataFormatter.standardizeVariant(variant, 'hgvs');
  assert.ok(typeof hgvs === 'string');
  console.log('✓ DataFormatter.standardizeVariant()');
}

// validateFormat – genetic-data
{
  const result = DataFormatter.validateFormat(sampleData, 'genetic-data');
  assert.ok(result.valid);
  console.log('✓ DataFormatter.validateFormat(genetic-data)');
}

// validateFormat – vcf string
{
  const vcf = DataFormatter.toVCF(sampleData);
  const result = DataFormatter.validateFormat(vcf, 'vcf');
  assert.ok(result.valid);
  console.log('✓ DataFormatter.validateFormat(vcf)');
}

// validateFormat – fasta string
{
  const fasta = DataFormatter.toFASTA(sampleData);
  const result = DataFormatter.validateFormat(fasta, 'fasta');
  assert.ok(result.valid);
  console.log('✓ DataFormatter.validateFormat(fasta)');
}

// chromosome normalisation edge cases
{
  const edgeCases = [
    { chromosome: 'chrX', position: '100', reference: 'A', alternate: 'T' },
    { chromosome: 'chrY', position: '200', reference: 'G', alternate: 'C' },
    { chromosome: 'chrM', position: '300', reference: 'T', alternate: 'A' },
  ];
  const formatted = await DataFormatter.formatForStorage({ variants: edgeCases });
  assert.equal(formatted.variants[0].chromosome, 'X');
  assert.equal(formatted.variants[1].chromosome, 'Y');
  assert.equal(formatted.variants[2].chromosome, 'MT');
  console.log('✓ DataFormatter chromosome normalisation (X, Y, MT)');
}

console.log('\n✅ formatter tests passed');
