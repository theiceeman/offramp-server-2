
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import TransactionsController from 'App/controllers/http/TransactionsController';
import WebSocketsController from 'App/controllers/http/WebSocketsController';
import { transactionStatus, transactionType } from 'App/helpers/types';
import Transaction from 'App/models/Transaction';
import FlutterwaveRaveV3 from 'flutterwave-node-v3';
// import dotenv from "dotenv"
// dotenv.config()

const FLW_TESTNET_PUBLIC_KEY = process.env.FLW_TESTNET_PUBLIC_KEY;
const FLW_TESTNET_SECRET_KEY = process.env.FLW_TESTNET_SECRET_KEY;

// const FLW_PROD_PUBLIC_KEY = null;
// const FLW_PROD_SECRET_KEY = null;


export default class Flutterwave {
  private sdk;

  constructor(environment: 'prod' | 'dev') {
    if (environment === 'dev') {
      this.sdk = new FlutterwaveRaveV3(FLW_TESTNET_PUBLIC_KEY, FLW_TESTNET_SECRET_KEY);
    }
  }

  public async initBankTransfer(txRef: string, amount: string, email: string): Promise<any> {
    try {
      const details = {
        tx_ref: txRef,
        amount: amount,
        email: email,
        currency: "NGN",
      };
      const response = await this.sdk.Charge.bank_transfer(details);
      // console.log({ response })
      if (response.status !== 'success')
        throw new Error(response.message)

      return response;
    } catch (error) {
      console.error(error)
      throw new Error(error)

    }

  }

  public async processWebhook({ request, response }: HttpContextContract) {
    try {
      const payload = request.body();

      const secretHash = process.env.FLW_SECRET_HASH;
      const signature = request.headers()["verif-hash"];

      // console.log({ signature, secretHash })
      // Verify req is from flutterwave
      if (!signature || (signature !== secretHash))
        throw new Error('signature error')


      // check payload status
      if (payload?.data?.processor_response !== 'success')
        throw new Error('status not successfull')

      // check if txn is already processed
      let txn = await Transaction.query().where('fiat_provider_tx_ref', payload?.data?.tx_ref)
      if (txn[0].status === transactionStatus.COMPLETED)
        throw new Error('txn already completed')

      // call flutterwave to verify
      const flutterwaveResponse = await new this.sdk.Transaction.verify({ id: payload?.data?.id });
      console.log({flutterwaveResponse})
      let txnType: "userBuy" | "userSell" = txn[0].type === transactionType.BUY_CRYPTO ? "userBuy" : "userSell";
      let actualAmountUserSends = new TransactionsController()._calcActualAmountUserSends(txn, txnType);

      let data = { status: '' }

      if (
        flutterwaveResponse.data.status === "successful"
        && flutterwaveResponse.data.amount >= actualAmountUserSends
        && flutterwaveResponse.data.currency === 'NGN') {
        data.status = transactionStatus.TRANSFER_CONFIRMED;
      } else {
        data.status = transactionStatus.FAILED;
      }

      await Transaction.query()
        .where("fiat_provider_tx_ref", payload?.data?.tx_ref)
        .update(data);

      await new WebSocketsController()
        .emitStatusUpdateToClient(txn[0].uniqueId)

      // response.status(200)
      response.status(200).send('webhook processed.');
    } catch (error) {
      console.log(error)
      // response.status(401);
      response.status(401).send('processing webhook failed!');
    }
  }


}
