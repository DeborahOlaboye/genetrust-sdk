import assert from 'node:assert/strict';
import {
  GeneticDataClient,
  MarketplaceClient,
  VerificationClient,
  ComplianceClient,
  ContractFactory,
} from '../src/contracts/index.js';

// --- mock Stacks API adapter ---
const mockStacksApi = {
  callContractFunction: async ({ functionName, functionArgs }) => ({
    txid: `mock-txid-${functionName}-${Date.now()}`,
    functionArgs,
  }),
  callReadOnlyFunction: async (address, name, fn, args) => ({
    type: 'ok',
    value: { type: 'bool', value: true },
  }),
};

const ADDRESS = 'SP1TESTADDRESS';

// GeneticDataClient
{
  const client = new GeneticDataClient(ADDRESS, 'genetic-data', mockStacksApi);

  const result = await client.registerGeneticData({
    dataId: 42,
    price: 1000,
    accessLevel: 2,
    metadataHash: new Array(32).fill(0),
    storageUrl: 'ipfs://test',
    description: 'test dataset',
  }, 'SP1SENDER');

  assert.equal(result.txId.startsWith('mock-txid-'), true);
  assert.equal(result.dataId, 42);

  const hasAccess = await client.verifyAccessRights(42, 'SP1USER');
  assert.ok(hasAccess);
  console.log('✓ GeneticDataClient registerGeneticData + verifyAccessRights');
}

// MarketplaceClient
{
  const client = new MarketplaceClient(ADDRESS, 'exchange', mockStacksApi);

  const listing = await client.createListing({
    listingId: 10,
    price: 5000,
    dataId: 42,
    accessLevel: 1,
    metadataHash: new Array(32).fill(0),
    requiresVerification: true,
  }, 'SP1SELLER');
  assert.ok(listing.txId);

  const eligible = await client.verifyPurchaseEligibility(10, 1);
  assert.ok(eligible);

  const purchase = await client.purchaseListingDirect(10, 1, Buffer.alloc(32), 'SP1BUYER');
  assert.ok(purchase.txId);
  console.log('✓ MarketplaceClient createListing + verifyPurchaseEligibility + purchaseListingDirect');
}

// VerificationClient
{
  const client = new VerificationClient(ADDRESS, 'attestations', mockStacksApi);

  const reg = await client.registerProof({
    dataId: 42,
    proofType: 1,
    proofHash: new Array(32).fill(1),
    parameters: new Array(256).fill(0),
  }, 'SP1PROVER');
  assert.ok(reg.txId);

  const verify = await client.verifyProof(1, 'SP1VERIFIER', Buffer.alloc(32), 'SP1VERIFIER');
  assert.ok(verify.txId);
  console.log('✓ VerificationClient registerProof + verifyProof');
}

// ComplianceClient
{
  const client = new ComplianceClient(ADDRESS, 'data-governance', mockStacksApi);

  const consent = await client.registerConsent({
    dataId: 42,
    researchConsent: true,
    commercialConsent: false,
    clinicalConsent: false,
    jurisdiction: 0,
    consentDuration: 8640,
  }, 'SP1OWNER');
  assert.ok(consent.txId);

  const audit = await client.logDataAccess(42, 1, Buffer.alloc(32), 'SP1ACCESSOR');
  assert.ok(audit.txId);
  console.log('✓ ComplianceClient registerConsent + logDataAccess');
}

// ContractFactory – createAllClients
{
  const addresses = {
    datasetRegistry: { address: ADDRESS, name: 'genetic-data' },
    exchange: { address: ADDRESS, name: 'exchange' },
    attestations: { address: ADDRESS, name: 'attestations' },
    dataGovernance: { address: ADDRESS, name: 'data-governance' },
  };
  const factory = ContractFactory.create({ addresses }, mockStacksApi);
  const clients = factory.createAllClients();

  // new keys
  assert.ok(clients.datasetRegistry instanceof GeneticDataClient);
  assert.ok(clients.exchange instanceof MarketplaceClient);
  assert.ok(clients.attestations instanceof VerificationClient);
  assert.ok(clients.dataGovernance instanceof ComplianceClient);

  // legacy aliases
  assert.ok(clients.geneticData instanceof GeneticDataClient);
  assert.ok(clients.marketplace instanceof MarketplaceClient);
  assert.ok(clients.verification instanceof VerificationClient);
  assert.ok(clients.compliance instanceof ComplianceClient);
  console.log('✓ ContractFactory.createAllClients() (new + legacy keys)');
}

// ContractFactory – individual create methods
{
  const addresses = {
    geneticData: { address: ADDRESS, name: 'genetic-data' },
    marketplace: { address: ADDRESS, name: 'exchange' },
    verification: { address: ADDRESS, name: 'attestations' },
    compliance: { address: ADDRESS, name: 'data-governance' },
  };
  const factory = new ContractFactory(addresses, mockStacksApi);

  assert.ok(factory.createGeneticDataClient() instanceof GeneticDataClient);
  assert.ok(factory.createMarketplaceClient() instanceof MarketplaceClient);
  assert.ok(factory.createVerificationClient() instanceof VerificationClient);
  assert.ok(factory.createComplianceClient() instanceof ComplianceClient);
  console.log('✓ ContractFactory individual create methods (legacy keys)');
}

// callReadOnlyFunction returns boolean directly (not wrapped)
{
  const directBoolApi = {
    callContractFunction: async () => ({ txid: 'test-txid' }),
    callReadOnlyFunction: async () => ({ type: 'ok', value: false }),
  };
  const client = new GeneticDataClient(ADDRESS, 'genetic-data', directBoolApi);
  const result = await client.verifyAccessRights(1, 'SP1');
  assert.equal(result, false);
  console.log('✓ GeneticDataClient.verifyAccessRights handles boolean value');
}

console.log('\n✅ contracts tests passed');
