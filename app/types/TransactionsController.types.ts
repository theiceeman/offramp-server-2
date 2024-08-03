export interface iValidateRatesResponse {
  amountInUsd: number
  amountType: 'sending' | 'receiving'
  senderCurrencyId: string
  recieverCurrencyId: string
}

export interface iValidateBuyResponse{
  paymentType: number
  amountInUsd: number
  recievingWalletAddress: string
  senderCurrencyId: string
  recieverCurrencyId: string
}
export interface iValidateSellResponse{
  paymentType: number
  amountInUsd: number
  recievingWalletAddress: string
  senderCurrencyId: string
  recieverCurrencyId: string
}
