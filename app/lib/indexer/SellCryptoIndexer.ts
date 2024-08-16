import { getEthersProvider } from "App/helpers/utils";
import { supportedChains, transactionStatus } from "App/helpers/types";
import Transaction from "App/models/Transaction";
import abiManager from "../contract-wallet/utils";
import Currency from "App/models/Currency";
import Env from '@ioc:Adonis/Core/Env'
import { ethers } from "ethers";
import WebSocketsController from "App/controllers/http/WebSocketsController";

const erc20Abi = abiManager.erc20Abi.abi


/**
 * This indexer is specifically for tracking & confirming
 * sell transactions in the system.
 */
export default class SellCryptoIndexer {
  private transferEventMatched: boolean;
  private expectedAmountMatched: boolean;
  private transactionHashMatched: string | null;

  private provider;
  private tokenContract;

  private transaction;
  private currency;
  private txnUniqueId;


  constructor(txnId: any) {
    this.txnUniqueId = txnId;
    this.transferEventMatched = false;
    this.expectedAmountMatched = false;
    this.transactionHashMatched = null;
  }



  /**
   * Pseudo constructor for indexer class, due to async function calls.
   * @param txnId
   * @returns void
   */
  public __initializer = async () => {
    try {
      this.transaction = await Transaction.query()
        .where('unique_id', this.txnUniqueId);

      this.currency = await Currency.query()
        .where('unique_id', this.transaction[0].senderCurrencyId)
      if (this.currency[0].type !== 'crypto') {
        console.error('error: ' + this.txnUniqueId + ' senderCurrency isnt crypto!')
        return;
      }

      this.provider = getEthersProvider(supportedChains[this.currency[0].network])
      const wallet = new ethers.Wallet(Env.get('OWNER_PRV_KEY'), this.provider);
      this.tokenContract = new ethers.Contract(this.currency[0].tokenAddress, erc20Abi, wallet);

      let transferEvents = await this.listenForTransferEvents()
      this.logCurrentStatus();
      if (!transferEvents) {
        return;
      }

      let confirmation: any = await this.streamNewBlocks()
      this.logCurrentStatus();
      if (!confirmation.status) {
        return;
      }

      let { txnHash, txnUniqueId, transactionConfirmed } = confirmation;
      await this.handleTransactionStatus(txnHash, txnUniqueId, transactionConfirmed)
      this.logCurrentStatus();
    } catch (error) {
      console.error(error)
    }
  }



  /**
   * Listens for transfer events on the crypto, then filters for matching `to` address & `amount`.
   */
  private listenForTransferEvents = async () => {
    console.info(`listening for Transfer Events on txnId:${this.txnUniqueId}...`)

    return new Promise((resolve) => {
      // @ts-ignore
      this.tokenContract.on('Transfer', async (from, to, amount, event) => {
        const expectedCurrencyAmount = this.transaction[0].amountInUsd * this.transaction[0].sendingCurrencyUsdRate
        const decimalValue = parseInt(amount) / 10 ** 18

        if (to.toLowerCase() === String(this.transaction[0].walletAddress).toLowerCase()
          && decimalValue >= expectedCurrencyAmount) {
          this.transactionHashMatched = event.transactionHash;
          this.transferEventMatched = true;
          this.expectedAmountMatched = true;
          resolve(true);
        }
      });
    });
  }



  /**
   * Polls the blockchain at intervals, to validate no of confirmations on transaction.
   */
  private streamNewBlocks = async () => {
    const txnHash = this.transactionHashMatched;
    const txnUniqueId = this.txnUniqueId;
    const eventMatched = this.transactionHashMatched;
    const amountMatched = this.expectedAmountMatched;

    let transactionConfirmed = false;
    if (!eventMatched || !amountMatched || txnHash == null) {
      return { status: false, txnHash, txnUniqueId, transactionConfirmed };
    }

    return new Promise((resolve) => {
      const intervalId = setInterval(async () => {
        console.info(`polling block confirmations for txnHash: ${txnHash}...`)

        let txnReciept = await this.provider.getTransaction(txnHash);
        // if (txnReciept?.confirmations >= 15) {
        if (txnReciept?.confirmations >= 1) {
          transactionConfirmed = true
          clearInterval(intervalId);
          resolve({ status: true, txnHash, txnUniqueId, transactionConfirmed });
        }
      }, 60000) // 1 min
    });
  }



  /**
   * Update transaction status in DB according to the indexer status.
   */
  private handleTransactionStatus = async (txnHash, txnUniqueId, transactionConfirmed) => {
    console.log(`updating status for txnId: ${txnUniqueId}...`)
    try {
      let data = {
        transaction_hash: txnHash,
        status: ''
      }

      if (transactionConfirmed) {
        data.status = transactionStatus.TRANSFER_CONFIRMED;
      } else {
        data.status = transactionStatus.FAILED;
      }

      await Transaction.query().where("unique_id", txnUniqueId)
        .update(data);

      await new WebSocketsController()
        .emitStatusUpdateToClient(txnUniqueId)
    } catch (error) {
      console.error(error)
    }
  }



  private logCurrentStatus = () => {
    console.info({
      transferEventMatched: this.transferEventMatched,
      expectedAmountMatched: this.expectedAmountMatched,
      transactionHashMatched: this.transactionHashMatched
    })

  }


}
