
import Web3 from 'web3';
import abiDecoder from 'abi-decoder';
import dotenv from 'dotenv'
import abiManager from './utils';
import { AbiItem } from 'web3-utils/types'
import { contractAddress, getRpcUrl } from 'App/helpers/utils';
import { supportedChains } from 'App/helpers/types';
dotenv.config()

const factoryContractAbi = abiManager.factoryContractAbi.abi as unknown as AbiItem
const walletContractAbi = abiManager.walletContractAbi.abi as unknown as AbiItem

const OWNER_PRV_KEY = process.env.OWNER_PRV_KEY
const OWNER_PUB_KEY = process.env.OWNER_PUB_KEY

const SALT_PREFIX = 'HARDLEY_CHASE_'
const ENABLE_AUTO_FLUSH = true


export default class OffRampWallet {
  client;
  network;
  factoryContract;
  cloneWalletContract;
  cloneWalletAddress;


  constructor(network: supportedChains, cloneAddress: null | string = null) {
    this.network = network;
    this.client = new Web3(getRpcUrl(network))

    this.factoryContract = new this.client.eth.Contract(
      factoryContractAbi, contractAddress[network].FACTORY_CONTRACT_ADDRESS.trim());

    if (cloneAddress !== null) {
      this.cloneWalletContract = new this.client.eth.Contract(
        walletContractAbi, cloneAddress.trim());
      this.cloneWalletAddress = cloneAddress;
    }
  }


  /**
   * Get balance of a token in a clone wallet.
   * @param {string} tokenAddress
   * @returns string
   */
  public async cloneWalletTokenBalance(tokenAddress) {
    const balance = await this.cloneWalletContract.methods.getBalance(tokenAddress).call();
    return this.client.utils.fromWei(balance);
  }


  /**
   * Deploy a clone contract for user using the factory.
   * @returns Object
   */
  public async factoryDeployAddress(_salt: string) {
    try {
      let data = {
        implementation: contractAddress[this.network].WALLET_CONTRACT_ADDRESS,
        name: SALT_PREFIX + _salt,
        enableAutoFlush: ENABLE_AUTO_FLUSH
      }

      const contract = new this.client.eth.Contract(factoryContractAbi, contractAddress[this.network].FACTORY_CONTRACT_ADDRESS.trim())
      let action = await contract.methods.deployAddress(data.implementation, data.name, data.enableAutoFlush)

      let receipt = await this._sendTransaction(action, contractAddress[this.network].FACTORY_CONTRACT_ADDRESS)
      const minedReceipt = await this._waitForTransactionReceipt(receipt.transactionHash);

      // Decode the logs
      abiDecoder.addABI([factoryContractAbi[0]]);
      const decodedLogs = abiDecoder.decodeLogs(minedReceipt.logs);

      // Extract decoded data
      const eventData = decodedLogs[0];

      return { ok: true, data: eventData.events };
    } catch (error) {
      return { ok: false, data: error };
    }
  }


  /**
   * Flush single token from clone contract address.
   * @param {string} tokenAddress
   * @returns Object
   */
  public async flushToken(tokenAddress) {
    try {
      const contract = new this.client.eth.Contract(walletContractAbi, this.cloneWalletAddress.trim())
      let action = await contract.methods.flushToken(tokenAddress)
      let result = await this._sendTransaction(action, this.cloneWalletAddress)
      return { ok: true, data: result };
    } catch (error) {
      return { ok: false, data: error };
    }
  }


  /**
   * Flush multiple tokens from clone contract.
   * @param {Array} tokenAddresses
   * @returns boolean
   */
  public async flushMultipleTokens(tokenAddresses) {
    try {
      const contract = new this.client.eth.Contract(walletContractAbi, this.cloneWalletAddress.trim())
      let action = await contract.methods.flushToken([...tokenAddresses])
      let result = await this._sendTransaction(action, this.cloneWalletAddress)
      return { ok: true, data: result };
    } catch (error) {
      return { ok: false, data: error };
    }
  }


  /**
   * Flush the ether/native token from the clone wallet to owner.
   * @returns Object
   */
  public async flushEth() {
    try {
      const contract = new this.client.eth.Contract(walletContractAbi, this.cloneWalletAddress.trim())
      let action = await contract.methods.flushToken(this.cloneWalletAddress)
      let result = await this._sendTransaction(action, this.cloneWalletAddress)
      return { ok: true, data: result };
    } catch (error) {
      return { ok: false, data: error };
    }
  }


  private async _sendTransaction(action, to) {
    try {
      let tx = {
        from: OWNER_PUB_KEY,
        to: to.trim(),
        data: action.encodeABI(),
        // gas: 1500000,
        gas: Math.floor(await action.estimateGas({ OWNER_PUB_KEY }) * 1.40),      //  gasLimit - measured in unit of gas
        // gasPrice: 333000000000        //  measured in wei
      }
      if (!OWNER_PRV_KEY)
        throw new Error('Provide private key!');

      const createTransaction = await this.client.eth.accounts.signTransaction(tx, OWNER_PRV_KEY);

      if (!createTransaction.rawTransaction)
        throw new Error('Provide private key!');

      return await this.client.eth.sendSignedTransaction(createTransaction.rawTransaction);
    } catch (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Waits for a sent transaction to be added to a block before resolving.
   * @param transactionHash
   * @returns txnReciept
   */
  async _waitForTransactionReceipt(transactionHash) {
    while (true) {
      const receipt = await this.client.eth.getTransactionReceipt(transactionHash);
      if (receipt !== null) {
        return receipt;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

}
