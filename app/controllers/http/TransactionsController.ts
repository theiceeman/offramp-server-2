import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { schema } from '@ioc:Adonis/Core/Validator'
import Currency from 'App/models/Currency';
import Transaction from 'App/models/Transaction';
import { formatErrorMessage, formatSuccessMessage, genRandomUuid } from 'App/helpers/utils';
import SellCryptoIndexer from 'App/lib/indexer/SellCryptoIndexer';
import { transactionStatus, transactionType } from 'App/helpers/types';
import { DateTime } from 'luxon';
import RolesController from './RolesController';
import TransactionsValidator from '../../formDataValidations/TransactionsRequestValidator';
import TransactionUtils from '../../utils/TransactionUtils';
import FiatAccountController from './FiatAccountController';
import PaymentProvidersController from './PaymentProvidersController';
import AppOverviewsController from './AppOverviewsController';
import WebSocketsController from './WebSocketsController';
import Setting from 'App/models/Setting';

export default class TransactionsController extends RolesController {


  public async createOfframpCrypto({ request, response, auth }: HttpContextContract) {
    try {
      /*
          whole process shld revert if there is an error at any stage.
       */
      const uniqueId = await this.allowOnlyLoggedInUsers(auth)
      const { amountInUsd, recieverCurrencyId, senderCurrencyId }
        = await new TransactionsValidator().validateSellTransaction(request)

      // check for minimum & max amt for transactions
      // let setting = await Setting.firstOrFail()
      // if (amountInUsd < setting.minTransactionAmount || amountInUsd > setting.maxTransactionAmount)
      //   throw new Error(`Transaction limit is between ${setting.minTransactionAmount.toLocaleString()} and ${setting.maxTransactionAmount.toLocaleString()} USD.`)

      /*
          if kyc setting is on, check if user has completed kyc.
       */

      await new FiatAccountController().checkIfUserHasBankAccount(uniqueId);
      await this.checkIfUserHasPendingTransaction(uniqueId, senderCurrencyId)

      let transaction = await new TransactionUtils()
        ._calculateRatesForUserSelling(senderCurrencyId, recieverCurrencyId, amountInUsd, transactionType.CRYPTO_OFFRAMP, 'sending')

      let txnWalletAddress = await new PaymentProvidersController()
        .processCryptoPaymentMethod(uniqueId, senderCurrencyId)

      let result = await Transaction.create({
        type: transactionType.CRYPTO_OFFRAMP,
        status: transactionStatus.TRANSACTION_CREATED,
        userId: uniqueId,
        amountInUsd: amountInUsd,
        senderCurrencyId,
        recieverCurrencyId,
        sendingCurrencyUsdRate: transaction[0].sendingCurrencyUsdRate,
        recievingCurrencyUsdRate: transaction[0].recievingCurrencyUsdRate,
        fee: transaction[0].fee,   // fee in USD
        walletAddress: txnWalletAddress,
        fiatProviderTxRef: genRandomUuid()
      });

      if (result !== null) {
        new SellCryptoIndexer(result.uniqueId).__initializer()

        /**
         * send email of transaction created.
         */
        let message = "Sell Crypto Order, created.";
        response.status(200).json(await formatSuccessMessage(message, result));
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * Validate a user's request to sell crypto.
   * @param param0
   */
  public async validateOffRampCrypto({ request, response, auth }: HttpContextContract) {
    try {
      await this.allowOnlyLoggedInUsers(auth)
      const { amountInUsd, amountType, recieverCurrencyId, senderCurrencyId }
        = await new TransactionsValidator().validateRatesCalculation(request)

      // check for minimum & max amt for transactions
      // let setting = await Setting.firstOrFail()
      // if (amountInUsd < setting.minTransactionAmount || amountInUsd > setting.maxTransactionAmount)
      //   throw new Error(`Transaction limit is between ${setting.minTransactionAmount.toLocaleString()} and ${setting.maxTransactionAmount.toLocaleString()} USD.`)

      let result = await new TransactionUtils()
        ._calculateRatesForUserSelling(senderCurrencyId, recieverCurrencyId, amountInUsd, transactionType.CRYPTO_OFFRAMP, amountType)

      response.status(200).json({ data: result, message: "Request successfull." });

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * Validate a user's request to buy crypto.
   * @param param0
   */
  public async validateBuyCrypto({ request, response, auth }: HttpContextContract) {
    try {
      await this.allowOnlyLoggedInUsers(auth)
      const { amountInUsd, amountType, recieverCurrencyId, senderCurrencyId }
        = await new TransactionsValidator().validateRatesCalculation(request)


      // let setting = await Setting.firstOrFail()
      // if (amountInUsd < setting.minTransactionAmount || amountInUsd > setting.maxTransactionAmount)
      //   throw new Error(`Transaction limit is between ${setting.minTransactionAmount.toLocaleString()} and ${setting.maxTransactionAmount.toLocaleString()} USD.`)

      let result = await new TransactionUtils()
        ._calculateRatesForUserBuying(senderCurrencyId, recieverCurrencyId, amountInUsd, transactionType.BUY_CRYPTO, amountType)

      response.status(200).json({ data: result, message: "Request successfull." });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async createBuyCrypto({ request, response, auth }: HttpContextContract) {
    try {
      /*
          whole process shld revert if there is an error at any stage.
       */

      const uniqueId = await this.allowOnlyLoggedInUsers(auth)
      const { amountInUsd, recieverCurrencyId, senderCurrencyId, paymentType, recievingWalletAddress }
        = await new TransactionsValidator().validateBuyTransaction(request);

      // check for minimum & max amt for transactions
      // let setting = await Setting.firstOrFail()
      // if (amountInUsd < setting.minTransactionAmount || amountInUsd > setting.maxTransactionAmount)
      //   throw new Error(`Transaction limit is between ${setting.minTransactionAmount.toLocaleString()} and ${setting.maxTransactionAmount.toLocaleString()} USD.`)

      await new FiatAccountController().checkIfUserHasBankAccount(uniqueId);
      // await this.checkIfUserHasPendingTransaction(uniqueId, senderCurrencyId)

      /*
          if kyc setting is on, check if user has completed kyc.
       */

      let transaction = await new TransactionUtils()
        ._calculateRatesForUserBuying(senderCurrencyId, recieverCurrencyId, amountInUsd, transactionType.BUY_CRYPTO, 'sending')

      let { fiatProviderTxRef, bankToProcessTransaction } = await new PaymentProvidersController()
        .processSelectedFiatPaymentMethod(recieverCurrencyId, paymentType, transaction[0].actual_amount_user_sends, uniqueId)

      let result = await Transaction.create({
        type: transactionType.BUY_CRYPTO,
        status: transactionStatus.TRANSACTION_CREATED,
        fiatProviderTxRef,
        userId: uniqueId,
        amountInUsd,
        senderCurrencyId,
        recieverCurrencyId,
        sendingCurrencyUsdRate: transaction[0].sendingCurrencyUsdRate,
        recievingCurrencyUsdRate: transaction[0].recievingCurrencyUsdRate,
        fee: transaction[0].fee,   // fee in USD
        recievingWalletAddress,
        fiatProviderResult: JSON.stringify(bankToProcessTransaction)
      });

      if (result !== null) {
        /**
         * send email of transaction created.
         */
        let message = "Buy Crypto Order, created.";
        response.status(200).json(await formatSuccessMessage(message, result))
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * For users to view their own transactions.
   * @param param0
   */
  public async viewLoggedInUserTransactions({ response, auth }: HttpContextContract) {
    try {
      const uniqueId = await this.allowOnlyLoggedInUsers(auth)

      let data = await Transaction.query()
        .where('user_id', uniqueId)
        .where('is_deleted', false)
        .orderBy('created_at', 'desc')

      response.status(200).json({ data });

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * Display details of a single transaction.
   * @param param0
   */
  public async viewSingleTransaction({ response, auth, params }: HttpContextContract) {
    try {
      const user = auth.use('user').user ?? auth.use('admin').user;
      if (!user) throw new Error('Authentication error!')

      let transaction = await Transaction.query()
        .preload('admin', (query) => query.select('email'))
        .preload('user', (query) => query.select('email', 'first_name', 'last_name'))
        .preload('sendingCurrency', (query) => query.select('name', 'network', 'symbol', 'market_usd_rate'))
        .preload('recieverCurrency', (query) => query.select('name', 'network', 'symbol', 'market_usd_rate'))
        .where('unique_id', String(params.id).toLowerCase())

      let txnType: "userBuy" | "userSell" = transaction[0].type === transactionType.BUY_CRYPTO ? "userBuy" : "userSell";
      let actualAmountUserReceives = this._calcActualAmountUserRecieves(transaction, txnType);
      let actualAmountUserSends = this._calcActualAmountUserSends(transaction, txnType);
      let txnProfitFromRate = await new AppOverviewsController()
        .calculateSingleTransactionProfitFromRate(String(params.id).toLowerCase());

      let _transaction = transaction[0].toJSON();
      _transaction.actual_amount_user_receives = actualAmountUserReceives;
      _transaction.actual_amount_user_sends = actualAmountUserSends;
      _transaction.txnProfitFromRate = txnProfitFromRate;

      response.status(200).json({ data: _transaction });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * For admins to view all transactions, can be filtered by: processedBy, userId, type.
   * @param param0
   */
  public async viewTransactions({ response, auth, request }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      const { processedBy, userId, type } = request.qs()

      let data = await Transaction.query()
        .preload('admin', (query) => query.select('email'))
        .preload('user', (query) => query.select('email'))
        .if(processedBy, query => query.where({ processedBy }))
        .if(userId, query => query.where({ userId }))
        .if(type, query => query.where({ type }))
        .orderBy('created_at', 'desc')

      response.status(200).json({ data });

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * For admin / lp to pick up transaction from pool and assign to self.
   * Hence updating transaction status to processing.
   * @param param0
   */
  public async setStatusProcessing({ request, response, auth }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user) throw new Error('Authentication error!')

      const data = request.body();
      const requestSchema = schema.create({ txnId: schema.string({ trim: true }) })
      const messages = { required: 'The {{ field }} is required.' }
      await request.validate({ schema: requestSchema, messages });

      let transaction = await Transaction.query().where('unique_id', data.txnId)
      if (transaction[0].status === transactionStatus.COMPLETED)
        throw new Error('Transaction already processed!')

      let result = await Transaction.query().where('unique_id', data.txnId)
        .update({ status: transactionStatus.PROCESSING, processedBy: user.uniqueId })

      if (result[0] > 0) {

        response.status(200).json({ data: "Transaction, now set to processing." });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * For admin / lp to set a transaction as failed.
   * @param param0
   */
  public async setStatusFailed({ request, response, auth }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user) throw new Error('Authentication error!')

      const data = request.body();
      const requestSchema = schema.create({ txnId: schema.string({ trim: true }) })
      const messages = { required: 'The {{ field }} is required.' }
      await request.validate({ schema: requestSchema, messages });

      let transaction = await Transaction.query().where('unique_id', data.txnId)
      if (transaction[0].status === transactionStatus.COMPLETED)
        throw new Error('Transaction already processed!')

      let result = await Transaction.query().where('unique_id', data.txnId)
        .update({ status: transactionStatus.FAILED, processedBy: user.uniqueId })

      if (result[0] > 0) {

        response.status(200).json({ data: "Transaction, now set to failed." });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * For admins / lp to release transaction back into the pool for others to process.
   * @param param0
   */
  public async reverseStatusToConfirmed({ request, response, auth }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user) throw new Error('Authentication error!')

      const data = request.body();
      const requestSchema = schema.create({ txnId: schema.string({ trim: true }) })
      const messages = { required: 'The {{ field }} is required.' }
      await request.validate({ schema: requestSchema, messages });

      let transaction = await Transaction.query().where('unique_id', data.txnId)
      if (transaction[0].status === transactionStatus.COMPLETED)
        throw new Error('Transaction already processed!')


      if (transaction[0].status !== transactionStatus.PROCESSING)
        throw new Error('Current transaction status should be processing!')

      let result = await Transaction.query().where('unique_id', data.txnId)
        .update({
          status: transactionStatus.TRANSFER_CONFIRMED,
          processedBy: null
        })

      if (result[0] > 0) {
        response.status(200).json({ data: "Transaction released back into pool." });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * For admins / lp to update transaction status as completed, after settling it.
   * @param param0
   */
  public async setStatusComplete({ request, response, auth }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      const data = request.body();
      const requestSchema = schema.create({
        settlementProof: schema.string({ trim: true }),
        txnId: schema.string({ trim: true }),
      })
      const messages = {
        required: 'The {{ field }} is required.'
      }
      await request.validate({ schema: requestSchema, messages });

      let result = await Transaction.query()
        .where('unique_id', data.txnId)
        .update({
          status: transactionStatus.COMPLETED,
          settlementProof: data.settlementProof,
          settledBy: user.uniqueId,
          settledAt: DateTime.local().toISO()
        })

      if (result[0] > 0) {
        /**
         * send email of transaction completed.
         */

        await new WebSocketsController()
          .emitStatusUpdateToClient(data.txnId)

        response.status(200).json({ data: "Transaction completed." });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * Calculates actual amount user will receive,
   * taking into consideration fees & receiving currency rate.
   * @param transaction
   * @param type
   * @returns
   */
  public _calcActualAmountUserRecieves(transaction: any, type: 'userBuy' | 'userSell') {
    let actualAmountUserReceives;
    let amountInUsd;

    if (transaction[0].fee === 0) {
      amountInUsd = Number(transaction[0].amountInUsd);
    } else {
      amountInUsd = Number(transaction[0].amountInUsd) - transaction[0].fee;
    }

    if (type === 'userBuy') {
      actualAmountUserReceives = amountInUsd / transaction[0].recievingCurrencyUsdRate;
    } else if (type === 'userSell') {
      actualAmountUserReceives = amountInUsd * transaction[0].recievingCurrencyUsdRate;
    }

    return Number(actualAmountUserReceives.toFixed(2));
  }

  /*
    we  want to remove fees from receiving currency only.
    But due to the dynamic form input in the frontend,
    we will allow backend to subtract from sending / receiving amount
    during validation, depending on amount & amountType passed.
    but after submission we will only subtract it from our receiving amount.
  */


  /**
   * Calculates actual amount user will send,
   * taking into consideration fees & sending currency rate.
   * @param transaction
   * @param type
   * @returns
   */
  public _calcActualAmountUserSendsDuringValidation(transaction: any, type: 'userBuy' | 'userSell') {
    let actualAmountUserSends;
    let amountInUsd;

    if (transaction[0].fee === 0) {
      amountInUsd = Number(transaction[0].amountInUsd);
    } else {
      amountInUsd = Number(transaction[0].amountInUsd) - transaction[0].fee;
    }

    if (type === 'userBuy') {
      actualAmountUserSends = amountInUsd * transaction[0].sendingCurrencyUsdRate;
    } else if (type === 'userSell') {
      actualAmountUserSends = amountInUsd / transaction[0].sendingCurrencyUsdRate;
    }

    return Number(actualAmountUserSends.toFixed(2));
  }

  /**
 * Calculates actual amount user will send,
 * taking into consideration fees & sending currency rate.
 * @param transaction
 * @param type
 * @returns
 */
  public _calcActualAmountUserSends(transaction: any, type: 'userBuy' | 'userSell') {
    let actualAmountUserSends;
    let amountInUsd = Number(transaction[0].amountInUsd);

    if (type === 'userBuy') {
      actualAmountUserSends = amountInUsd * transaction[0].sendingCurrencyUsdRate;
    } else if (type === 'userSell') {
      actualAmountUserSends = amountInUsd / transaction[0].sendingCurrencyUsdRate;
    }

    return Number(actualAmountUserSends.toFixed(2));
  }


  /**
   * check if a user has a pending transaction in a sending currency.
   * @param userUniqueId
   * @param sendingCurrencyId
   */
  public async checkIfUserHasPendingTransaction(userUniqueId, sendingCurrencyId: string) {
    try {
      let sendingCurrency = await Currency.query()
        .where('unique_id', sendingCurrencyId).where('is_deleted', false)

      let pendingTransaction = await Transaction.query()
        .where('user_id', userUniqueId)
        .where('sender_currency_id', sendingCurrencyId)
        .where('status', transactionStatus.TRANSACTION_CREATED)

      if (pendingTransaction.length > 0)
        throw new Error(`You have a pending ${sendingCurrency[0].symbol} transaction.`)

    } catch (error) {
      throw new Error(error.message)
    }
  }

}


