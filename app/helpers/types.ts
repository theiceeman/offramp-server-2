
export enum supportedChains {
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
  local = 'local'
}

export const NETWORKS = {
  TEST: [
    supportedChains.sepolia,
    supportedChains.assetchain_testnet
  ],
  MAIN: [supportedChains.bsc]
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
