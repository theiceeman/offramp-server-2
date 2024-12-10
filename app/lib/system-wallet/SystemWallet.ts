/*
  view native coin balance for network
  view balances of currencies in wallet
  view system wallet
  view logs on token movements to wallet.

  move tokens to wallet.
  withdraw from wallet. - super_admin, password
 */

import { supportedChains } from "App/helpers/types";
import { getRpcUrl } from "App/helpers/utils";
import Currency from "App/models/Currency";
import Web3 from "web3";
import { AbiItem } from "web3-utils/types";
import abiManager from "../contract-wallet/utils";
import UserWallet from "App/models/UserWallet";
const { BigNumber } = require("@ethersproject/bignumber");

const erc20Abi = abiManager.erc20Abi.abi as unknown as AbiItem;
const walletContractAbi = abiManager.walletContractAbi
  .abi as unknown as AbiItem;

/**
 * Class for managing system wallet, where crypto liquidity is stored.
 */
export default class SystemWallet {
  private _systemWalletAddress = process.env.OWNER_PUB_KEY;
  private network;
  private client;

  constructor(network: supportedChains) {
    this.network = network;
    this.client = new Web3(getRpcUrl(network));
  }

  public address() {
    return this._systemWalletAddress;
  }

  public nativeCoinbalance() {
    return this.getEtherBalance();
  }

  public async viewBalances() {
    try {
      let cryptoCurrency = await Currency.query()
        .where("type", "crypto")
        .where("network", this.network)
        .where("is_deleted", false);

      let data: Array<any> = [];
      for (const currency of cryptoCurrency) {
        let balance = await this.tokenBalance(currency.tokenAddress);
        data.push({
          network: this.network,
          symbol: currency.symbol,
          balance,
        });
      }

      return data;
    } catch (error) {
      throw new Error(error);
    }
  }

  public async flushTokensToSystemWallet() {
    try {
      let wallets = await UserWallet.query()
        .where("network", this.network)
        .where("is_deleted", false);

      let cryptoCurrency = await Currency.query()
        .where("type", "crypto")
        .where("network", this.network)
        .where("is_deleted", false);

      let currencies: Array<string> = [];
      cryptoCurrency.map((e: any) => {
        currencies.push(e.tokenAddress);
      });

      for (const wallet of wallets) {
        await this.flushMultipleTokens(wallet.walletAddress, currencies);
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  public async withdraw(amount, tokenAddress, toAddress) {
    /*
      encrypt prv key, so code is required to decrypt key before using it for transactions.
     */
    await this.transferToken(amount, tokenAddress, toAddress);
  }

  /**
   * Get balance of a token in system wallet.
   * @returns
   */
  private async tokenBalance(tokenAddress: string) {
    const contract = new this.client.eth.Contract(
      erc20Abi,
      tokenAddress.trim()
    );
    const balance = await contract.methods
      .balanceOf(this._systemWalletAddress)
      .call();
    return this.client.utils.fromWei(balance);
  }

  /**
   * Get native coin balance of system wallet on respective chain.
   * @returns
   */
  private async getEtherBalance() {
    var balance = await this.client.eth.getBalance(this._systemWalletAddress);
    return this.client.utils.fromWei(balance);
  }

  /**
   * Flush tokens from individual wallets to system wallet.
   * @param walletAddress
   * @param tokenContractAddresses
   */
  private async flushMultipleTokens(
    walletAddress: string,
    tokenContractAddresses: Array<string>
  ) {
    const contract = new this.client.eth.Contract(
      walletContractAbi,
      walletAddress.trim()
    );
    let action = await contract.methods.flushMultipleTokens(
      tokenContractAddresses
    );

    let tx = {
      // nonce,
      from: process.env.OWNER_PUB_KEY,
      to: walletAddress.trim(),
      data: action.encodeABI(),
      gas: 1500000,
      // gas: Math.floor(await action.estimateGas({ from }) * 1.40),      //  gasLimit - measured in unit of gas
      // gasPrice: 333000000000        //  measured in wei
    };

    const createTransaction = await this.client.eth.accounts.signTransaction(
      tx,
      process.env.OWNER_PRV_KEY
    );
    let flushTokens = await this.client.eth.sendSignedTransaction(
      createTransaction.rawTransaction
    );
    console.log({ flushTokens });
  }

  /**
   * Transfer tokens from system wallet to other wallets.
   * @param amount
   * @param tokenAddress
   * @param to - address to recieve token.
   */
  public async transferToken(amount, tokenAddress, to) {
    console.log('transferring...');
    // return;
    const contract = new this.client.eth.Contract(
      erc20Abi,
      tokenAddress.trim()
    );
    let _amount = BigNumber.from(
      (amount * 10 ** 18).toLocaleString("fullwide", { useGrouping: false })
    );
    let action = await contract.methods.transfer(to, _amount);

    // console.log({ estimateGas: await action.estimateGas({ from }) });
    let tx = {
      from: process.env.OWNER_PUB_KEY,
      to: tokenAddress.trim(),
      data: action.encodeABI(),
      // gas: 1500000,
      gas: await action.estimateGas({ from: process.env.OWNER_PUB_KEY }),
      gasPrice: await this.client.eth.getGasPrice(), // Dynamically fetch the gas price
    };
    const createTransaction = await this.client.eth.accounts.signTransaction(
      tx,
      process.env.OWNER_PRV_KEY
    );
    let transferToken = await this.client.eth.sendSignedTransaction(
      createTransaction.rawTransaction
    );
    console.log({ transferToken });
  }
}
