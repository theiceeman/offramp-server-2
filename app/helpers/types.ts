
export enum supportedChains {
  bsc = 'bsc',
  sepolia = 'sepolia',
  local = 'local'
}

export enum currencyNetwork {
  fiat = 'fiat',
  bsc = 'bsc',
  sepolia = 'sepolia',
  local = 'local'
}

export const NETWORKS = {
  TEST: [supportedChains.sepolia],
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
