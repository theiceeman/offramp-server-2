import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { iGenerateBankAccount, IPaymentProvider, VerifyPaymentResponse } from "./interface";
import { Request } from "../../helpers/https"
import { createTransferRecipient } from "./utils/paystack.utils";
import crypto from "crypto"



interface params {
  accountNumber: string;
  amount: number;
  userEmail: string;
  bankCode: string;
}

const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;


/**
 * Library for integration with paystack payment provider.
 */
export default class Paystack implements IPaymentProvider {
  private publicKey: string;
  private secretKey: string;
  private baseUrl: string = 'https://api.paystack.co';

  constructor() {
    if (!PAYSTACK_SECRET_KEY || !PAYSTACK_PUBLIC_KEY) {
      throw new Error('PAYSTACK_PUBLIC_KEY, PAYSTACK_PUBLIC_KEY not defined in env')

    }
    this.publicKey = PAYSTACK_PUBLIC_KEY;
    this.secretKey = PAYSTACK_SECRET_KEY;
  }




  /**
   * Generates a dedicated virtual account for receiving payments
   */
  public async generateBankAccount(txRef: string, amount: string, email: string): Promise<iGenerateBankAccount> {
    try {

      const headers = {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      };

      const payload = {
        email,
        amount: Math.round(parseFloat(amount) * 100), // NGN in kobo
        currency: "NGN",
        bank_transfer: {
          account_expires_at: null
        }
      }

      const response = await Request.post(`${this.baseUrl}/charge`, payload, { headers });
      if (!response.ok) {
        throw new Error('generating paystack bank account failed');
      }

      return {
        accountNumber: response.data.data.data.account_number,
        bankName: response.data.data.data.bank.name,
        data: response.data.data.data
      };

    } catch (error) {
      console.error(error);
      throw new Error(error.message || 'Error generating bank account');
    }
  }



  public async initSendBankTransfer({ accountNumber, amount, userEmail, bankCode }: params): Promise<any> {
    try {
      const recipientCode = await createTransferRecipient(bankCode, accountNumber, userEmail)

      const headers = {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      };

      const payload = {
        source: "balance",
        reason: "bank_transfer",
        amount: amount * 100, // kobo
        recipient: recipientCode
      }

      const response = await Request.post(`${this.baseUrl}/transfer`, payload, { headers });
      if (!response.ok) {
        throw new Error('paystack bank transfer failed');
      }

      return response;
    } catch (error) {
      console.error(error)
      throw new Error(error)
    }
  }


  public async processWebhook({ request, response }: HttpContextContract) {
    try {
      // validate event
      const hash = crypto.createHmac('sha512', this.secretKey)
        .update(JSON.stringify(request.body)).digest('hex');

      if (hash == request.headers['x-paystack-signature']) {
        // Retrieve the request's body
        const event = request.body;
        // Do something with event
      }
      response.send(200);



    } catch (error) {
      console.log(error)
      response.status(401).send('processing webhook failed!');
    }
  }


  /**
   * This queries current status of a transaction from the payment provider.
   * @param reference
   * @returns
   */
  async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    try {
      let success = false;
      let transactionFound = false;

      const headers = {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      };

      const response = await Request.get(`${this.baseUrl}/transaction/verify/${reference}`,
        { headers },
      );
      if (response.data.data.message.includes("reference not found")) {
        return { ...response.data, success, transactionFound };
      }

      if (response.data.data.status === 'success') {
        transactionFound = true;
        success = true;
        return { ...response.data, success, transactionFound };
      }

      return { ...response.data, success, transactionFound: true };
    } catch (error) {
      console.error(error)
      throw new Error(error)
    }
  }

}
