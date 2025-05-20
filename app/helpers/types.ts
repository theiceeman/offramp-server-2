
export enum TokenStandard {
  ERC20 = 'ERC20',
  BEP20 = 'BEP20'
}

export enum supportedChains {
  base_sepolia = 'base_sepolia',
  base = 'base',
  bsc = 'bsc',
  sepolia = 'sepolia',
  assetchain_testnet = 'assetchain_testnet',
  local = 'local'
}

export enum currencyNetwork {
  fiat = 'fiat',
  bsc = 'bsc',
  sepolia = 'sepolia',
  assetchain_testnet = 'assetchain_testnet',
  local = 'local',
  base = 'base',
  base_sepolia = 'base_sepolia',
}


export interface iChainTokenStandard {
  [chain: string]: TokenStandard;
}

export const ChainTokenStandard: iChainTokenStandard = {
  [supportedChains.base_sepolia]: TokenStandard.ERC20,
  [supportedChains.base]: TokenStandard.ERC20,
  [supportedChains.sepolia]: TokenStandard.ERC20,
  [supportedChains.bsc]: TokenStandard.BEP20,
  [supportedChains.assetchain_testnet]: TokenStandard.ERC20,
  [supportedChains.local]: TokenStandard.ERC20
};

export const NETWORKS = {
  TEST: [
    supportedChains.sepolia,
    supportedChains.assetchain_testnet,
    supportedChains.base_sepolia
  ],
  MAIN: [supportedChains.bsc, supportedChains.base]
};

export enum transactionStatus {
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSFER_CONFIRMED = 'TRANSFER_CONFIRMED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum transactionType {
  CRYPTO_OFFRAMP = 'CRYPTO_OFFRAMP',
  SEND_FIAT_CRYPTO = 'SEND_FIAT_CRYPTO',
  BUY_CRYPTO = 'BUY_CRYPTO',
}

export enum userPaymentType {
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export enum transactionProcessingType {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL'
}

export interface IPCMessage {
  type: 'socket_emit';
  data: {
    socketId: string;
    status: string;
    txnId: string;
  }
}

export const PROCESS_TYPES = {
  APP: 'application',
  INDEXER: 'indexer'
} as const;
