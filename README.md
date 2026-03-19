# genetrust-sdk

JavaScript/TypeScript SDK for the **GeneTrust** privacy-preserving genetic data marketplace on the [Stacks](https://stacks.co) blockchain (L2 on Bitcoin).

## Features

- **Contract clients** — interact with GeneTrust Clarity smart contracts (dataset registry, marketplace, verification, compliance)
- **Zero-knowledge proofs** — generate and verify gene-presence, gene-variant, and aggregate proofs without revealing raw genetic data
- **Encrypted storage** — AES-GCM multi-tier encryption with IPFS-backed decentralized storage
- **Browser SDK** — wallet-connected browser API via `@stacks/connect`
- **Utilities** — cryptographic helpers, data formatters (VCF, FASTA, JSON-LD), performance profiler

## Installation

```bash
npm install genetrust-sdk
```

## Quick Start

### Node.js (server-side)

```js
import { GeneTrust } from 'genetrust-sdk';

const sdk = GeneTrust.create();

// Initialize with your Stacks API adapter and contract addresses
await sdk.initialize(stacksApiAdapter, {
  geneticData: { address: 'SP...', name: 'genetic-data' },
  marketplace: { address: 'SP...', name: 'exchange' },
  verification: { address: 'SP...', name: 'attestations' },
  compliance: { address: 'SP...', name: 'data-governance' },
});

// Store encrypted genetic data
const result = await sdk.storeGeneticData(
  { variants: [...], genes: [...] },
  'your-password',
  { generateProofs: true, registerOnChain: true }
);

// Purchase data from the marketplace
const purchase = await sdk.purchaseGeneticData(listingId, 1, buyerAddress);
```

### Browser (wallet-connected)

```js
import { geneTrust } from 'genetrust-sdk/browser';

await geneTrust.initialize({
  stacksNode: 'https://api.testnet.hiro.so',
  contracts: {
    datasetRegistry: { address: 'SP...', name: 'genetic-data' },
    exchange: { address: 'SP...', name: 'exchange' },
  },
  userAddress: 'SP...',
});

// Registers dataset on-chain via wallet (Hiro, Xverse, etc.)
await geneTrust.registerDataset({
  dataId: 12345,
  price: 1000000, // microSTX
  accessLevel: 1,
  storageUrl: 'ipfs://...',
  description: 'BRCA1 variant data',
});
```

## Module Exports

| Import path | Exports |
|---|---|
| `genetrust-sdk` | `GeneTrust`, all classes |
| `genetrust-sdk/browser` | `geneTrust` (browser SDK) |
| `genetrust-sdk/contracts` | `ContractFactory`, `GeneticDataClient`, `MarketplaceClient`, `VerificationClient`, `ComplianceClient` |
| `genetrust-sdk/storage` | `StorageFactory`, `StorageManager`, `EncryptionManager`, `IPFSClient` |
| `genetrust-sdk/zk-proofs` | `ZKProofFactory`, `GenePresenceProofGenerator`, `GeneVariantProofGenerator`, `AggregateProofGenerator`, `ProofVerifier`, `ProofUtils` |
| `genetrust-sdk/utils` | `CryptoUtils`, `DataFormatter`, `PerformanceProfiler`, `profiler`, `sanitize` |
| `genetrust-sdk/config` | `Phase2Config`, `PerformanceConfig` |

## Zero-Knowledge Proofs

```js
import { ZKProofFactory } from 'genetrust-sdk/zk-proofs';

// Prove a gene is present without revealing the full dataset
const generator = ZKProofFactory.createGenerator('gene-presence');
const proof = await generator.generatePresenceProof(geneticData, 'BRCA1');

// Verify a proof
const verifier = ZKProofFactory.createVerifier();
const result = await verifier.verifyProof(proof, { targetGene: 'BRCA1' });
console.log(result.valid); // true
```

Supported proof types: `gene-presence`, `gene-variant`, `aggregate`

## Encrypted Storage

```js
import { StorageFactory } from 'genetrust-sdk/storage';

const stack = StorageFactory.createGeneticDataStack({
  ipfs: { host: 'localhost', port: 5001 },
  encryption: { keyDerivationIterations: 100000 },
});

// Store with 3-tier access control (basic / detailed / full)
const stored = await stack.storage.storeGeneticData(data, password);

// Retrieve with access level 1 (basic metadata only)
const retrieved = await stack.storage.retrieveGeneticData(stored.storageUrl, password, 1);
```

## Configuration

```js
import { Phase2Config } from 'genetrust-sdk/config';

// Load from environment variables (NODE_ENV, IPFS_HOST, IPFS_PORT)
const config = Phase2Config.fromEnvironment();

// Or create for a specific environment
const prodConfig = Phase2Config.forEnvironment('production');
```

## License

MIT © [Deborah Olaboye](https://github.com/DeborahOlaboye)
