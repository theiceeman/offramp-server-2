import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export interface iGenerateBankAccount {
  accountNumber: string,
  bankName: string,
  [key: string]: any; // This allows for additional keys with any type
}

export interface VerifyPaymentResponse {
  success: boolean;
  transactionFound: boolean;
  [key: string]: any; // This allows for additional keys with any type
}


export interface IPaymentProvider {

  /**
   * Generates a dedicated virtual account for receiving payments
   * @param txRef Unique transaction reference.
   * @param amount Transaction amount.
   * @param email Customer email.
   * @returns Promise that resolves to the transaction response.
   */
  generateBankAccount(txRef: string, amount: string, email: string): Promise<iGenerateBankAccount>;

  /**
   * Processes a webhook notification from Flutterwave.
   * @param {HttpContextContract} context HTTP context.
   */
  processWebhook({ request, response }: HttpContextContract): Promise<void>;
}
