import { getEthersProvider } from "App/helpers/utils";
import { supportedChains, transactionStatus, transactionType } from "App/helpers/types";
import Transaction from "App/models/Transaction";
import abiManager from "../contract-wallet/utils";
import Currency from "App/models/Currency";
import Env from '@ioc:Adonis/Core/Env'
import { ethers } from "ethers";
import WebSocketsController from "App/controllers/http/WebSocketsController";
import TransactionsController from "App/controllers/http/TransactionsController";
import Paystack from "../fiat-provider/Paystack";
import UserFiatAccount from "App/models/UserFiatAccount";

const erc20Abi = abiManager.erc20Abi.abi;

const MAX_CONFIRMATION = 10;

export default class SellCryptoIndexer {
  private provider;
  private tokenContract;
  private transaction;
  private currency;
  private txnUniqueId;
  private startBlock: number;
  private endBlock: number;
  private blocksScanned: number = 0;

  constructor(txnId: any) {
    this.txnUniqueId = txnId;
  }

  public __initializer = async () => {
    try {
      console.log('initializing..');
      this.transaction = await Transaction.query()
        .where('unique_id', this.txnUniqueId);

      this.currency = await Currency.query()
        .where('unique_id', this.transaction[0].senderCurrencyId);

      if (this.currency[0].type !== 'crypto') {
        console.error('error: ' + this.txnUniqueId + ' senderCurrency isnt crypto!');
        return;
      }

      this.provider = getEthersProvider(supportedChains[this.currency[0].network]);
      const wallet = new ethers.Wallet(Env.get('OWNER_PRV_KEY'), this.provider);
      this.tokenContract = new ethers.Contract(this.currency[0].tokenAddress, erc20Abi, wallet);

      // Set initial block range
      this.startBlock = await this.provider.getBlockNumber() - 10;
      this.endBlock = this.startBlock + 1200; // Look ahead ~1 hour

      const matchingTransfer = await this.monitorFutureBlocks() as Transaction;
      if (!matchingTransfer) {
        await this.handleTransactionStatus(null, this.txnUniqueId, false);
        return;
      }

      const confirmed = await this.waitForConfirmations(matchingTransfer.transactionHash);
      await this.handleTransactionStatus(matchingTransfer.transactionHash, this.txnUniqueId, confirmed);
    } catch (error) {
      console.error('Indexer error:', error);
      await this.handleTransactionStatus(null, this.txnUniqueId, false);
    }
  }

  private monitorFutureBlocks = async () => {
    console.log(`monitoring ID: ${this.transaction[0].uniqueId}..`)
    const filter = this.tokenContract.filters.Transfer(
      null,
      this.transaction[0].walletAddress
    );

    const txnType = this.transaction[0].type === transactionType.CRYPTO_OFFRAMP ? "userSell" : "userBuy";
    if (txnType !== "userSell") {
      console.error('This should be a sell crypto transaction!');
      return null;
    }

    const expectedCurrencyAmount = this.transaction[0].amountInUsd * this.transaction[0].sendingCurrencyUsdRate;

    return new Promise((resolve, reject) => {
      const checkNewBlocks = async () => {
        try {
          const currentBlock = await this.provider.getBlockNumber();
          console.log(`currentBlock`, currentBlock);

          if (currentBlock > this.endBlock) {
            console.log('Exceeded maximum block range without finding matching transfer');
            resolve(null);
            return;
          }

          // Only query new blocks we haven't seen yet
          if (currentBlock > this.startBlock + this.blocksScanned) {
            const fromBlock = this.startBlock + this.blocksScanned;
            const toBlock = currentBlock;

            console.log(`Scanning blocks ${fromBlock} to ${toBlock}`);
            const events = await this.tokenContract.queryFilter(filter, fromBlock, toBlock);

            for (const event of events) {
              const decimalValue = parseInt(event.args[2].toString()) / 10 ** 18;
              if (decimalValue >= expectedCurrencyAmount) {
                console.log(`Found matching transfer in block ${event.blockNumber} for ID: ${this.transaction[0].uniqueId}`);
                resolve(event);
                return;
              }
            }

            this.blocksScanned = toBlock - this.startBlock;
          }

          // Continue checking
          setTimeout(checkNewBlocks, 3000); // Check every 3 seconds
        } catch (error) {
          console.error('Error checking blocks:', error);
          reject(error);
        }
      };

      // Start checking
      checkNewBlocks();
    });
  }

  private waitForConfirmations = async (txHash: string): Promise<boolean> => {
    const maxAttempts = 8;
    const pollInterval = 10000; // 10 secs

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.info(`Checking confirmations for ${txHash} (attempt ${attempt + 1}/${maxAttempts})`);

      const txReceipt = await this.provider.getTransaction(txHash);
      if (txReceipt?.confirmations >= MAX_CONFIRMATION) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return false;
  }

  private handleTransactionStatus = async (txnHash: string | null, txnUniqueId: string, transactionConfirmed: boolean) => {
    try {
      console.info(`handling transaction ${txnUniqueId}`);

      const data = {
        transaction_hash: txnHash,
        status: transactionConfirmed ? transactionStatus.TRANSFER_CONFIRMED : transactionStatus.FAILED
      };

      await Transaction.query()
        .where("unique_id", txnUniqueId)
        .update(data);


      await new WebSocketsController()
      .emitStatusUpdateToClient(txnUniqueId);

      if (transactionConfirmed) {
        // Handle the additional steps for a successful sell transaction
        const transaction = await Transaction.query()
          .preload('user', (query) => query.select('email'))
          .where("unique_id", txnUniqueId)
          .first();

        if (transaction === undefined || transaction === null) {
          throw new Error('Transaction does not exist');
        }

        const actualAmountUserReceives = new TransactionsController()
          ._calcActualAmountUserRecieves([transaction], "userSell");

        const account = await UserFiatAccount.query()
          .preload('bank', (query) => query.select('bankName', 'unique_id', 'paystackCode'))
          .where('user_id', transaction?.userId);

        const params = {
          accountNumber: account[0].accountNo,
          amount: actualAmountUserReceives,  // kobo
          userEmail: transaction.user.email,
          bankCode: account[0].bank.paystackCode,
          txRef: transaction.fiatProviderTxRef
        };

        await new Paystack().initSendBankTransfer(params);
      }

    } catch (error) {
      console.error('Error updating transaction status:', error);
    }
  }
}
