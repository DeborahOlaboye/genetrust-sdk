/**
 * GeneTrust SDK — TypeScript Type Definitions
 * @module genetrust-sdk
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

export type NetworkType = 'mainnet' | 'testnet' | 'devnet';
export type Environment = 'development' | 'testing' | 'staging' | 'production';
export type AccessLevel = 1 | 2 | 3;
export type ProofType = 'gene-presence' | 'gene-variant' | 'aggregate';
export type DataFormat = 'json' | 'vcf' | 'fasta' | 'csv';
export type EncryptionAlgorithm = 'aes-128-gcm' | 'aes-192-gcm' | 'aes-256-gcm';

// ── Genetic Data ──────────────────────────────────────────────────────────────

export interface GeneticVariant {
  gene: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  rsid?: string;
  quality?: number;
  filter?: string;
  info?: Record<string, unknown>;
}

export interface GeneticData {
  genes?: string[];
  variants?: GeneticVariant[];
  sequences?: GeneticSequence[];
  metadata?: GeneticDataMetadata;
}

export interface GeneticSequence {
  id: string;
  sequence: string;
  description?: string;
  length?: number;
}

export interface GeneticDataMetadata {
  sampleId?: string;
  collectionDate?: string;
  organism?: string;
  referenceGenome?: string;
  sequencingPlatform?: string;
  coverageDepth?: number;
  [key: string]: unknown;
}

// ── Zero-Knowledge Proofs ─────────────────────────────────────────────────────

export interface ZKProof {
  proofType: ProofType;
  proofId: string;
  commitment: string;
  proof: string;
  publicInputs: Record<string, unknown>;
  proofHash: Buffer;
  parameters: Record<string, unknown>;
  valid: boolean;
  generatedAt: number;
}

export interface ProofVerificationResult {
  valid: boolean;
  proofType: ProofType;
  proofId: string;
  verifiedAt: number;
  details?: string;
  error?: string;
}

export interface GenePresenceProofOptions {
  privacyLevel?: 'high' | 'medium' | 'low';
  includeChromosome?: boolean;
}

export interface GeneVariantProofOptions {
  confidenceThreshold?: number;
  includePosition?: boolean;
}

export interface AggregateProofOptions {
  confidenceLevel?: number;
  maxDataPoints?: number;
  statisticsToInclude?: string[];
}

export interface ProofRequest<T = unknown> {
  targetGene?: string;
  targetVariant?: GeneticVariant;
  aggregateQuery?: Record<string, unknown>;
  options?: T;
}

export interface BatchVerificationResult {
  total: number;
  valid: number;
  invalid: number;
  results: ProofVerificationResult[];
}

// ── Storage ───────────────────────────────────────────────────────────────────

export interface StorageOptions {
  accessLevel?: AccessLevel;
  compress?: boolean;
  pin?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StorageResult {
  datasetId: string;
  storageUrl: string;
  cid?: string;
  metadataHash?: Buffer;
  encryptedAt: number;
  accessLevels: AccessLevel[];
  size?: number;
}

export interface RetrievalResult {
  data: GeneticData;
  accessLevel: AccessLevel;
  metadata?: Record<string, unknown>;
  retrievedAt?: number;
}

export interface ConnectivityStatus {
  overall: boolean;
  ipfs?: boolean;
  encryption?: boolean;
  error?: string;
}

export interface StorageStats {
  totalDatasets: number;
  totalSize: number;
  cachedItems?: number;
  ipfsConnected: boolean;
}

export interface EncryptionConfig {
  algorithm?: EncryptionAlgorithm;
  keyDerivationIterations?: number;
  saltLength?: number;
  ivLength?: number;
  tagLength?: number;
}

export interface IPFSConfig {
  host?: string;
  port?: number;
  protocol?: 'http' | 'https';
  timeout?: number;
  autoPinning?: boolean;
  gateways?: string[];
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export interface ContractAddress {
  address: string;
  name: string;
}

export interface ContractAddresses {
  datasetRegistry?: ContractAddress;
  exchange?: ContractAddress;
  attestations?: ContractAddress;
  dataGovernance?: ContractAddress;
  /** @deprecated Use datasetRegistry */
  geneticData?: ContractAddress;
  /** @deprecated Use exchange */
  marketplace?: ContractAddress;
  /** @deprecated Use attestations */
  verification?: ContractAddress;
  /** @deprecated Use dataGovernance */
  compliance?: ContractAddress;
}

export interface DatasetRegistration {
  dataId: number;
  price: number;
  accessLevel: AccessLevel;
  metadataHash: number[];
  storageUrl: string;
  description?: string;
}

export interface MarketplaceListing {
  listingId?: number;
  dataId: number;
  price: number;
  accessLevel: AccessLevel;
  seller?: string;
  active?: boolean;
}

export interface ProofRegistration {
  dataId: number;
  proofType: number;
  proofHash: Buffer;
  parameters: Record<string, unknown>;
}

export interface ConsentRegistration {
  dataId: number;
  researchConsent: boolean;
  commercialConsent: boolean;
  clinicalConsent: boolean;
  jurisdiction: number;
  consentDuration: number;
}

// ── SDK Configuration ─────────────────────────────────────────────────────────

export interface GeneTrustOptions {
  config?: Phase2ConfigInstance;
  storage?: Partial<StorageOptions>;
  network?: NetworkType;
}

export interface Phase2ConfigInstance {
  environment: Environment;
  getConfig(component?: string): Record<string, unknown>;
  updateConfig(component: string, updates: Record<string, unknown>): void;
  getIPFSConfig(): IPFSConfig;
  getZKProofConfig(): Record<string, unknown>;
  getEncryptionConfig(): EncryptionConfig;
  getContractConfig(): Record<string, unknown>;
  setContractAddresses(addresses: ContractAddresses): void;
  validateConfig(): { valid: boolean; errors: string[]; warnings: string[] };
  exportConfig(includeSecrets?: boolean): string;
  importConfig(json: string, merge?: boolean): void;
  getFeatureFlags(): FeatureFlags;
}

export interface FeatureFlags {
  enableZKProofs: boolean;
  enableIPFSStorage: boolean;
  enableCompliance: boolean;
  enableMarketplace: boolean;
  enableBatchProcessing: boolean;
  enableMetrics: boolean;
  enableDebugLogging: boolean;
}

// ── SDK Results ───────────────────────────────────────────────────────────────

export interface StoreGeneticDataResult {
  success: boolean;
  datasetId: string;
  storage: StorageResult;
  proofs: Record<string, ZKProof[]>;
  blockchain: BlockchainRegistrationResult | null;
  storedAt: number;
}

export interface RetrieveGeneticDataResult {
  success: boolean;
  data: GeneticData;
  accessLevel: AccessLevel;
  metadata?: Record<string, unknown>;
  proofVerification?: BatchVerificationResult | null;
  permissionCheck?: PermissionCheckResult | null;
  retrievedAt: number;
}

export interface BlockchainRegistrationResult {
  data?: Record<string, unknown>;
  proofs?: Record<string, unknown>;
  error?: string;
}

export interface PermissionCheckResult {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  checkedAt: number;
  error?: string;
}

export interface MarketplaceListingResult {
  success: boolean;
  listingId?: number;
  transaction: unknown;
  compliance?: unknown;
  createdAt: number;
}

export interface PurchaseResult {
  success: boolean;
  listingId: number;
  accessLevel: AccessLevel;
  transaction: unknown;
  txId: number[];
  purchasedAt: number;
}

export interface SDKStatus {
  initialized: boolean;
  environment: Environment;
  components: {
    storage: boolean;
    contracts: boolean;
    zkProofs: boolean;
  };
  connectivity: Record<string, unknown>;
  version: string;
  error?: string;
}

export interface PerformanceMetrics {
  profiler: Record<string, unknown>;
  storage: Record<string, unknown> | null;
  ipfs: Record<string, unknown> | null;
  config: Record<string, unknown>;
}

// ── Utility Types ─────────────────────────────────────────────────────────────

export interface CryptoKeyResult {
  key: Buffer;
  salt: Buffer;
}

export interface HMACResult {
  hmac: string;
  algorithm: string;
}

export interface CommitmentResult {
  commitment: string;
  nonce: string;
}

export interface DataIntegrityResult {
  valid: boolean;
  hash: string;
  expectedHash: string;
}

export interface DataFormatterOutput {
  format: DataFormat;
  data: unknown;
  metadata?: Record<string, unknown>;
  formattedAt?: number;
}

// ── Error Types ───────────────────────────────────────────────────────────────

export class GeneTrustError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GeneTrustError';
    Object.setPrototypeOf(this, GeneTrustError.prototype);
  }
}

export class StorageError extends GeneTrustError {
  constructor(message: string, details?: unknown) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class ProofGenerationError extends GeneTrustError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROOF_GENERATION_ERROR', details);
    this.name = 'ProofGenerationError';
  }
}

export class ContractError extends GeneTrustError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONTRACT_ERROR', details);
    this.name = 'ContractError';
  }
}

export class EncryptionError extends GeneTrustError {
  constructor(message: string, details?: unknown) {
    super(message, 'ENCRYPTION_ERROR', details);
    this.name = 'EncryptionError';
  }
}
