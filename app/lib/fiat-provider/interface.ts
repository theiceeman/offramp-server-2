import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/**
 * Interface for payment provider integrations.
 */
export interface IPaymentProvider {
  /**
   * Initializes a bank transfer transaction.
   * @param txRef Unique transaction reference.
   * @param amount Transaction amount.
   * @param email Customer email.
   * @returns Promise that resolves to the transaction response.
   */
  generateBankAccount(txRef: string, amount: string, email: string): Promise<any>;

  /**
   * Processes a webhook notification from Flutterwave.
   * @param {HttpContextContract} context HTTP context.
   */
  processWebhook({ request, response }: HttpContextContract): Promise<void>;
}
