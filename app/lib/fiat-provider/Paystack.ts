import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { iGenerateBankAccount, IPaymentProvider, VerifyPaymentResponse } from "./interface";
import { Request } from "../../helpers/https"
import { createTransferRecipient } from "./utils/paystack.utils";
import crypto from "crypto"
import { PROCESS_TYPES, supportedChains, transactionStatus, transactionType } from 'App/helpers/types';
import Transaction from 'App/models/Transaction';
import TransactionsController from 'App/controllers/http/TransactionsController';
import SystemWallet from '../system-wallet/SystemWallet';
import { startIndexerProcess } from 'App/services/indexer/Process';
import WebSocketsController from 'App/controllers/http/WebSocketsController';



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
        },
        reference: txRef
      }

      const response = await Request.post(`${this.baseUrl}/charge`, payload, { headers });
      if (!response.ok) {
        throw new Error('generating paystack bank account failed');
      }

      console.log({ response: response.data.data })

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
      const payload = request.body();
      const headers = request.headers();

      // validate event
      const hash = crypto.createHmac('sha512', this.secretKey)
        .update(JSON.stringify(payload)).digest('hex');

      console.log('payload', JSON.stringify(payload))
      console.log({ hash })
      console.log('headers', request.headers())
      console.log('paystack-signature', headers['x-paystack-signature'])

      if (hash !== headers['x-paystack-signature']) {
        throw new Error('paystack signature error')
      }




      process.env.PROCESS_TYPE = PROCESS_TYPES.APP;

      // const payload = request.body();

      // check payload status
      if (payload?.data?.status !== 'success') {
        throw new Error('status not successfull')
      }

      // check if txn is already processed
      let txn = await Transaction.query()
        .preload('recieverCurrency', (query) => query.select('name', 'network', 'tokenAddress'))
        .where('fiat_provider_tx_ref', payload?.data?.reference)

      if (txn[0].status === transactionStatus.COMPLETED) {
        throw new Error('txn already completed')
      }

      // call provider to verify
      const response = await this.verifyPayment(payload?.data?.reference);

      let txnType: "userBuy" | "userSell" = txn[0].type === transactionType.BUY_CRYPTO ? "userBuy" : "userSell";
      let actualAmountUserSends = new TransactionsController()._calcActualAmountUserSends(txn, txnType);


      let data = { status: '' }
      if (
        response.success
        && response.data.amount / 100 >= actualAmountUserSends
        && response.data.currency === 'NGN') {
        data.status = transactionStatus.TRANSFER_CONFIRMED;
      } else {
        data.status = transactionStatus.FAILED;
      }

      if (data.status === transactionStatus.TRANSFER_CONFIRMED) {

        await Transaction.query()
          .where("fiat_provider_tx_ref", payload?.data?.reference)
          .update(data);

        let recievingCurrencyNetwork = txn[0].recieverCurrency.network as unknown as supportedChains;
        let actualAmountUserReceives = new TransactionsController()
          ._calcActualAmountUserRecieves(txn, txnType);

        if (!txn[0].recievingWalletAddress) {
          throw new Error('recievingWalletAddress does not exist');
        }

        // Start indexer process
        startIndexerProcess(txn[0].uniqueId);

        new SystemWallet(recievingCurrencyNetwork)
          .transferToken(actualAmountUserReceives, txn[0].recieverCurrency.tokenAddress, txn[0].recievingWalletAddress)

      }
      await new WebSocketsController()
        .emitStatusUpdateToClient(txn[0].uniqueId)

      response.status(200).send('webhook processed.');



    } catch (error) {
      console.log(error)
      response.status(401).send('processing paystack webhook failed!');
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
        return { ...response.data.data, success, transactionFound };
      }

      return { ...response.data, success, transactionFound: true };
    } catch (error) {
      console.error(error)
      throw new Error(error)
    }
  }

}
