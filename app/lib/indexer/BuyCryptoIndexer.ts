import { getEthersProvider } from "App/helpers/utils";
import { supportedChains, transactionStatus, transactionType } from "App/helpers/types";
import Transaction from "App/models/Transaction";
import abiManager from "../contract-wallet/utils";
import Currency from "App/models/Currency";
import Env from '@ioc:Adonis/Core/Env'
import { ethers } from "ethers";
import WebSocketsController from "App/controllers/http/WebSocketsController";
import TransactionsController from "App/controllers/http/TransactionsController";

const erc20Abi = abiManager.erc20Abi.abi;
const MAX_CONFIRMATION = process.env.MAX_CONFIRMATION;
const MAX_ATTEMPTS = process.env.MAX_ATTEMPTS;

export default class BuyCryptoIndexer {
  private provider;
  private tokenContract;
  private transaction;
  private currency;
  private txnUniqueId;
  private startBlock: number;
  private endBlock: number;
  private blocksScanned: number = 0;

  constructor(txnId: any) {
    if (!MAX_CONFIRMATION || !MAX_ATTEMPTS) {
      console.error('MAX_CONFIRMATION or MAX_ATTEMPTS is not set in the environment variables.');
      throw new Error('MAX_CONFIRMATION or MAX_ATTEMPTS is not set in the environment variables.');
    }

    this.txnUniqueId = txnId;
  }

  public __initializer = async () => {
    try {
      console.log('initializing..');
      this.transaction = await Transaction.query()
        .where('unique_id', this.txnUniqueId);

      this.currency = await Currency.query()
        .where('unique_id', this.transaction[0].recieverCurrencyId);

      if (this.currency[0].type !== 'crypto') {
        console.error('error: ' + this.txnUniqueId + ' recievingCurrency isnt crypto!');
        return;
      }

      this.provider = getEthersProvider(supportedChains[this.currency[0].network]);
      const wallet = new ethers.Wallet(Env.get('OWNER_PRV_KEY'), this.provider);
      this.tokenContract = new ethers.Contract(this.currency[0].tokenAddress, erc20Abi, wallet);

      // Set initial block range
      this.startBlock = await this.provider.getBlockNumber();
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
    console.log('monitoring..')
    const filter = this.tokenContract.filters.Transfer(
      null,
      this.transaction[0].recievingWalletAddress
    );

    const txnType = this.transaction[0].type === transactionType.BUY_CRYPTO ? "userBuy" : "userSell";
    if (txnType !== "userBuy") {
      console.error('This should be a buy crypto transaction!');
      return null;
    }

    const expectedAmount = new TransactionsController()
      ._calcActualAmountUserRecieves(this.transaction, txnType);

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
              if (decimalValue >= expectedAmount) {
                console.log(`Found matching transfer in block ${event.blockNumber}`);
                resolve(event);
                return;
              }
            }

            this.blocksScanned = toBlock - this.startBlock;
          }

          // Continue checking
          setTimeout(checkNewBlocks, 3000); // Check every 3 seconds (BSC block time)
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
    // const maxAttempts = 20;
    const pollInterval = 10000; // 10 secs

    for (let attempt = 0; attempt < Number(MAX_ATTEMPTS); attempt++) {
      const txReceipt = await this.provider.getTransaction(txHash);
      console.log({ txReceipt: txReceipt.hash })

      console.info(`Checking confirmations for ${txHash} (attempt ${attempt + 1}/${MAX_ATTEMPTS}) - confimations=${txReceipt?.confirmations}`);

      if (txReceipt?.confirmations >= Number(MAX_CONFIRMATION)) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return false;
  }

  private handleTransactionStatus = async (txnHash: string | null, txnUniqueId: string, transactionConfirmed: boolean) => {
    try {
      const data = {
        transaction_hash: txnHash,
        status: transactionConfirmed ? transactionStatus.COMPLETED : transactionStatus.FAILED
      };

      await Transaction.query()
        .where("unique_id", txnUniqueId)
        .update(data);
      // console.log('handling...', txnUniqueId, vv); return;

      await new WebSocketsController()
        .emitStatusUpdateToClient(txnUniqueId);
    } catch (error) {
      console.error('Error updating transaction status:', error);
    }
  }
}
