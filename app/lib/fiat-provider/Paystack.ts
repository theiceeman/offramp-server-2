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
  amount: number; // NGN
  userEmail: string;
  bankCode: string;
  txRef: string;
}

const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL;


/**
 * Library for integration with paystack payment provider.
 */
export default class Paystack implements IPaymentProvider {
  private secretKey: string;
  private baseUrl: string;

  constructor() {
    if (!PAYSTACK_SECRET_KEY || !PAYSTACK_PUBLIC_KEY || !PAYSTACK_BASE_URL) {
      throw new Error('PAYSTACK_PUBLIC_KEY, PAYSTACK_PUBLIC_KEY, PAYSTACK_BASE_URL not defined in env')

    }
    this.secretKey = PAYSTACK_SECRET_KEY;
    this.baseUrl = PAYSTACK_BASE_URL;
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


  /**
   * This is used to make a transfer to users account.
   * @param param0
   * @returns
   */
  public async initSendBankTransfer({ accountNumber, amount, userEmail, bankCode, txRef }: params): Promise<any> {
    try {
      const recipient = await createTransferRecipient(bankCode, accountNumber, userEmail)

      const headers = {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      };

      const payload = {
        source: "balance",
        reason: "bank_transfer",
        amount: Math.round(parseFloat(String(amount)) * 100), // kobo
        recipient: recipient.recipientCode,
        reference: txRef
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



  /**
   * This queries current status of a user's payment from paystack.
   * This is used for verifying normal payments not for transfers.
   * https://paystack.com/docs/payments/
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
        return { ...response.data.data, success, transactionFound };
      }

      if (response.data.data.data.status === 'success') {
        transactionFound = true;
        success = true;
        return { ...response.data.data, success, transactionFound };

      } else {
        return { ...response.data.data, success, transactionFound: true };
      }

    } catch (error) {
      console.error(error)
      throw new Error(error)
    }
  }


  /**
   * Process webhook from users payment.
   * @param param0
   */
  public async processWebhook({ request, response }: HttpContextContract) {
    try {
      console.log('request', request)
      const payload = request.body();
      const headers = request.headers();

      // ensure request is from paystack
      const hash = crypto.createHmac('sha512', this.secretKey)
        .update(JSON.stringify(payload)).digest('hex');

      if (hash !== headers['x-paystack-signature']) {
        throw new Error('paystack signature error')
      }

      process.env.PROCESS_TYPE = PROCESS_TYPES.APP;

      // check payload status
      if (payload?.data?.status !== 'success') {
        throw new Error('status not successfull')
      }

      // check if txn is already processed
      let txn = await Transaction.query()
        .preload('recieverCurrency', (query) => query.select('name', 'network', 'tokenAddress'))
        .where('fiat_provider_tx_ref', payload?.data?.reference)
      console.log({ txn })


      if (txn.length > 1) {
        throw new Error(`Multiple transactions found for fiat_provider_tx_ref: ${payload?.data?.reference}`);
      }

      if (txn[0].status === transactionStatus.COMPLETED) {
        throw new Error('Transaction already completed')
      }

      if (txn[0].type === transactionType.BUY_CRYPTO) {
        await this._processWebhookForBuyTransaction(txn, payload);
      } else if (txn[0].type === transactionType.CRYPTO_OFFRAMP) {
        await this._processWebhookForSellTransaction(txn, payload);
      }

      response.status(200).send('Webhook processed.');

    } catch (error) {
      console.log(error)
      response.status(401).send('Processing paystack webhook failed!');
    }
  }


  private async _processWebhookForBuyTransaction(txn: Transaction[], payload) {
    try {
      // call provider to verify
      const paystackRes = await this.verifyPayment(payload?.data?.reference);

      let txnType: "userBuy" | "userSell" = txn[0].type === transactionType.BUY_CRYPTO ? "userBuy" : "userSell";
      let actualAmountUserSends = new TransactionsController()._calcActualAmountUserSends(txn, txnType);

      console.log('paystackRes', paystackRes)
      console.log('actualAmountUserSends', actualAmountUserSends)

      let data = { status: '' }
      if (paystackRes.success && paystackRes.data.amount / 100 >= actualAmountUserSends && paystackRes.data.currency === 'NGN') {
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
      await new WebSocketsController().emitStatusUpdateToClient(txn[0].uniqueId)

    } catch (error) {
      console.error(error);
      throw new Error('Failed to process webhook for buy transaction');
    }
  }


  private async _processWebhookForSellTransaction(txn: Transaction[], payload) {
    try {

      let data = { status: '' }
      if (payload.event === "transfer.success") {
        data.status = transactionStatus.COMPLETED;
      } else {
        data.status = transactionStatus.FAILED;
      }

      await Transaction.query()
        .where("unique_id", txn[0].uniqueId)
        .where("fiat_provider_tx_ref", payload?.data?.reference)
        .update(data);

      await new WebSocketsController().emitStatusUpdateToClient(txn[0].uniqueId)

    } catch (error) {
      console.error(error);
      throw new Error('Failed to process webhook for buy transaction');
    }
  }



}


// {
//   "event": "charge.success",
//   "data": {
//     "id": 4792858123,
//     "domain": "test",
//     "status": "success",
//     "reference": "d46b0dcc-b4d8-473e-907f-c603115d8298",
//     "amount": 187502,
//     "message": null,
//     "gateway_response": "Approved",
//     "paid_at": "2025-03-19T16:22:17.000Z",
//     "created_at": "2025-03-19T16:21:32.000Z",
//     "channel": "bank_transfer",
//     "currency": "NGN"
//   }
// }


// {
//   "event": "transfer.success",
//   "data": {
//     "amount": 30000,
//     "currency": "NGN",
//     "domain": "test",
//     "failures": null,
//     "id": 37272792,
//     "integration": {
//       "id": 463433,
//       "is_live": true,
//       "business_name": "Boom Boom Industries NG"
//     },
//     "reason": "Have fun...",
//     "reference": "1jhbs3ozmen0k7y5efmw",
//     "source": "balance",
//     "source_details": null,
//     "status": "success",
//     "titan_code": null,
//     "transfer_code": "TRF_wpl1dem4967avzm",
//     "transferred_at": null,
//     "created_at": "2020-10-26T12:28:57.000Z",
//     "updated_at": "2020-10-26T12:28:57.000Z"
//   }
// }
