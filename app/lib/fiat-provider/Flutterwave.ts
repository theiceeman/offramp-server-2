
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import TransactionsController from 'App/controllers/http/TransactionsController';
import WebSocketsController from 'App/controllers/http/WebSocketsController';
import { PROCESS_TYPES, supportedChains, transactionStatus, transactionType } from 'App/helpers/types';
import Transaction from 'App/models/Transaction';
import FlutterwaveRaveV3 from 'flutterwave-node-v3';
import SystemWallet from '../system-wallet/SystemWallet';
import { startIndexerProcess } from 'App/services/indexer/Process';

const FLW_TESTNET_PUBLIC_KEY = process.env.FLW_TESTNET_PUBLIC_KEY;
const FLW_TESTNET_SECRET_KEY = process.env.FLW_TESTNET_SECRET_KEY;

/**
 * Library for integration with flutterwave payment provider.
 */
export default class Flutterwave {
  private sdk;

  constructor(environment: 'prod' | 'dev') {
    this.sdk = new FlutterwaveRaveV3(FLW_TESTNET_PUBLIC_KEY, FLW_TESTNET_SECRET_KEY);

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
      process.env.PROCESS_TYPE = PROCESS_TYPES.APP;

      const payload = request.body();

      const secretHash = process.env.FLW_SECRET_HASH;
      const signature = request.headers()["verif-hash"];

      // Verify req is from flutterwave
      if (!signature || (signature !== secretHash))
        throw new Error('signature error')

      // check payload status
      if (payload?.data?.processor_response !== 'success')
        throw new Error('status not successfull')

      // check if txn is already processed
      let txn = await Transaction.query()
        .preload('recieverCurrency', (query) => query.select('name', 'network', 'tokenAddress'))
        .where('fiat_provider_tx_ref', payload?.data?.tx_ref)
      if (txn[0].status === transactionStatus.COMPLETED)
        throw new Error('txn already completed')

      // call flutterwave to verify
      const flutterwaveResponse = await new this.sdk.Transaction.verify({ id: payload?.data?.id });

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

      if (data.status === transactionStatus.TRANSFER_CONFIRMED) {

        await Transaction.query()
          .where("fiat_provider_tx_ref", payload?.data?.tx_ref)
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
      response.status(401).send('processing webhook failed!');
    }
  }


}
