// Browser-exposed SDK implementing real Stacks calls via @stacks/connect
// Exposes window.geneTrust with a minimal contract-centric API.

import { request } from '@stacks/connect';
import {
  uintCV,
  principalCV,
  bufferCV,
  boolCV,
  stringUtf8CV,
  cvToJSON,
  PostConditionMode,
} from '@stacks/transactions';
import { fetchCallReadOnlyFunction } from '@stacks/transactions';

const state = {
  contracts: null,
  initialized: false,
  network: null,
  userAddress: null,
  appDetails: {
    name: 'GeneTrust',
    icon: '/favicon.svg',
  },
  cache: {
    listings: [],
    datasets: [],
  },
};

function toNetwork(nodeUrl) {
  const coreApiUrl = nodeUrl || 'https://api.testnet.hiro.so';
  const isTestnet = !nodeUrl || String(nodeUrl).includes('testnet');
  return {
    coreApiUrl,
    chainId: isTestnet ? 0x80000000 : 0x00000001,
    name: isTestnet ? 'testnet' : 'mainnet'
  };
}

function randomBytes(len = 32) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

function zeroHash32() {
  return new Uint8Array(32);
}

async function ro(contract, fn, args) {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: fn,
      functionArgs: args,
      network: state.network,
      senderAddress: contract.address,
    });
    return result;
  } catch (error) {
    console.error('Read-only call failed:', error);
    throw error;
  }
}

export const geneTrust = {
  config: {
    setContractAddresses(addresses) {
      state.contracts = addresses || null;
    },
  },

  async initialize({ stacksNode, contracts, userAddress } = {}) {
    state.contracts = contracts || null;
    state.network = toNetwork(stacksNode);
    state.userAddress = userAddress;
    state.initialized = true;
    return { ok: true, initialized: true };
  },

  async registerDataset({ dataId, price, accessLevel, metadataHash, storageUrl, description }) {
    if (!state.initialized) throw new Error('SDK not initialized');
    if (!state.contracts?.datasetRegistry) throw new Error('Dataset registry contract not configured');

    const registry = state.contracts.datasetRegistry;
    const mh = metadataHash instanceof Uint8Array ? metadataHash : zeroHash32();

    const functionArgs = [
      uintCV(Number(dataId)),
      uintCV(Number(price || 0)),
      uintCV(Number(accessLevel || 1)),
      bufferCV(mh),
      stringUtf8CV(String(storageUrl || '')),
      stringUtf8CV(String(description || '')),
    ];

    try {
      const result = await request('stx_callContract', {
        contract: `${registry.address}.${registry.name}`,
        functionName: 'register-genetic-data',
        functionArgs,
        network: state.network,
        appDetails: state.appDetails,
        postConditions: [],
      });

      const dataset = {
        id: dataId,
        dataId,
        owner: state.userAddress,
        price,
        accessLevel,
        description,
        storageUrl,
        accessLevels: [1, 2, 3],
        createdAt: Date.now(),
        storedAt: Date.now(),
        stats: { variants: 0, genes: 0 },
        txId: result?.txid,
      };

      state.cache.datasets.unshift(dataset);
      return dataset;
    } catch (error) {
      if (error.message?.includes('User rejected') || error.message?.includes('cancelled')) {
        throw new Error('Transaction cancelled by user');
      }
      throw new Error(`Failed to register dataset: ${error.message || error}`);
    }
  },

  async storeGeneticData(geneticData, options = {}) {
    const datasetId = Math.floor(Math.random() * 1_000_000);
    return {
      datasetId,
      storageUrl: `ipfs://mock-${datasetId}`,
      options,
    };
  },

  async createMarketplaceListing({ dataId, price, accessLevel, description, metadataHash, requiresVerification = true }) {
    if (!state.initialized) throw new Error('SDK not initialized');
    if (!state.contracts?.exchange || !state.contracts?.datasetRegistry) throw new Error('Contracts not configured');

    const exchange = state.contracts.exchange;
    const registry = state.contracts.datasetRegistry;
    const listingId = Math.floor(Math.random() * 1_000_000);
    const mh = metadataHash instanceof Uint8Array ? metadataHash : zeroHash32();

    const functionArgs = [
      uintCV(listingId),
      uintCV(Number(price || 0)),
      principalCV(`${registry.address}.${registry.name}`),
      uintCV(Number(dataId)),
      uintCV(Number(accessLevel || 1)),
      bufferCV(mh),
      boolCV(!!requiresVerification),
    ];

    try {
      const result = await request('stx_callContract', {
        contract: `${exchange.address}.${exchange.name}`,
        functionName: 'create-listing',
        functionArgs,
        network: state.network,
        appDetails: state.appDetails,
        postConditions: [],
      });

      state.cache.listings.unshift({ listingId, dataId, price, accessLevel, description, active: true, createdAt: Date.now() });
      return { listingId, txId: result?.txid, result };
    } catch (error) {
      throw error;
    }
  },

  async getDataset(dataId) {
    if (!state.contracts?.datasetRegistry) throw new Error('Dataset registry not configured');
    const registry = state.contracts.datasetRegistry;
    try {
      const res = await ro(registry, 'get-dataset-details', [uintCV(Number(dataId))]);
      const json = cvToJSON(res);
      return json?.value || json;
    } catch (e) {
      return null;
    }
  },

  async getListing(listingId) {
    if (!state.contracts?.exchange) throw new Error('Contracts not configured');
    const exchange = state.contracts.exchange;
    try {
      const res = await ro(exchange, 'get-listing', [uintCV(Number(listingId))]);
      const json = cvToJSON(res);
      return json?.value || json;
    } catch (e) {
      return null;
    }
  },

  async listMyDatasets() {
    return state.cache.datasets.slice();
  },

  async listMarketplaceListings({ ownerOnly = false } = {}) {
    return state.cache.listings.slice();
  },

  async listMarketplaceListingsOnChain({ startId = 1, endId = 100 } = {}) {
    if (!state.contracts?.exchange) throw new Error('Contracts not configured');
    const exchange = state.contracts.exchange;
    const results = [];
    const lo = Math.min(Number(startId), Number(endId));
    const hi = Math.max(Number(startId), Number(endId));

    for (let id = lo; id <= hi; id++) {
      try {
        const res = await ro(exchange, 'get-listing', [uintCV(id)]);
        const json = cvToJSON(res);
        const opt = json?.value || json?.some || json?.value?.some;
        if (!opt) continue;
        const tuple = opt?.value || opt;
        const owner = tuple?.owner?.value || tuple?.owner;
        const priceStr = tuple?.price?.value || tuple?.price;
        const accessLevelStr = tuple?.['access-level']?.value || tuple?.['access-level'];
        const active = tuple?.active?.value ?? tuple?.active;
        const dataIdStr = tuple?.['data-id']?.value || tuple?.['data-id'];
        results.push({
          listingId: id,
          owner,
          price: priceStr ? Number(String(priceStr).replace(/^u/, '')) : undefined,
          accessLevel: accessLevelStr ? Number(String(accessLevelStr).replace(/^u/, '')) : undefined,
          active: typeof active === 'boolean' ? active : !!active,
          dataId: dataIdStr ? Number(String(dataIdStr).replace(/^u/, '')) : undefined,
        });
      } catch (e) {
        // ignore missing IDs
      }
    }
    return results;
  },

  async purchaseGeneticData({ listingId, accessLevel }) {
    if (!state.initialized) throw new Error('SDK not initialized');
    if (!state.contracts?.exchange) throw new Error('Contracts not configured');

    const exchange = state.contracts.exchange;
    const txIdBytes = randomBytes(32);
    const functionArgs = [
      uintCV(Number(listingId)),
      uintCV(Number(accessLevel || 1)),
      bufferCV(txIdBytes),
    ];

    try {
      const result = await request('stx_callContract', {
        contract: `${exchange.address}.${exchange.name}`,
        functionName: 'purchase-listing-direct',
        functionArgs,
        network: state.network,
        appDetails: state.appDetails,
        postConditions: [],
      });

      return { success: true, txId: result?.txid || 'pending', listingId, accessLevel };
    } catch (error) {
      throw error;
    }
  },

  getStatus() {
    return {
      initialized: state.initialized,
      network: state.network?.coreApiUrl,
      userAddress: state.userAddress,
      contracts: state.contracts,
      datasets: state.cache.datasets.length,
      listings: state.cache.listings.length,
      time: Date.now(),
    };
  },
};

if (typeof window !== 'undefined') {
  window.geneTrust = geneTrust;
}
