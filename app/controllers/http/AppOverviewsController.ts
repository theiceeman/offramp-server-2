import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Database from '@ioc:Adonis/Lucid/Database'
import { transactionStatus, transactionType } from 'App/helpers/types'
import Setting from 'App/models/Setting'

export default class AppOverviewsController {
  /*
  total currently being processed
  total in system [USDT, SOL, ETH]

   */

  public async view({ auth }: HttpContextContract) {
    let user = auth.use('admin').user;
    if (!user?.uniqueId)
      throw new Error('Authentication error!')

    let settings = await Setting.query().where('id', 1)

    let totalProcessed = await Database.from('transactions')
      .where('status', transactionStatus.COMPLETED)?.sum('amount_in_usd')

    let totalNoOfUsers = await Database.from('users')
      .where('is_deleted', false)?.count('id')

    let pendingSupportTickets = await Database.from('tickets')
      .where('status', 'open')
      .where('main', true)
      ?.count('id')

    let totalFromFees = await Database.from('transactions')
      .where('status', transactionStatus.COMPLETED)?.sum('fee')

    let totalProfitFromRate = await this.calculateProfitFromRate()

    return {
      totalVolumeProcessed: totalProcessed[0].sum ?? 0,   // USD - total amount processed by system
      totalProfitFromRate: totalProfitFromRate,   // USD  - total profit made by system from the rates.
      totalAmountFromFee: totalFromFees[0].sum ?? 0,    //  USD - total transaction fees collected.
      totalLpProfit: (settings[0].lpProfitPercentage * totalProfitFromRate) / 100,  //  amount of profit for lp's from totalProfitFromRate.
      totalSystemProfit: (settings[0].systemProfitPercentage * totalProfitFromRate) / 100, // amount of profit for system from totalProfitFromRate.
      noOfPendingTransactions: 0,
      pendingSupportTickets: pendingSupportTickets[0]?.count ?? 0,
      totalNoOfUsers: totalNoOfUsers[0].count ?? 0,
    }
  }

  private async calculateProfitFromRate() {
    let profit = 0;
    let transactions = await Database.from('transactions')
      .where('status', transactionStatus.COMPLETED)

    for (const transaction of transactions) {
      let recievingCurrency = await Database.from('currencies')
        .where('unique_id', transaction.reciever_currency_id)

      let recievingAmountAtSystemRate = transaction.amount_in_usd * transaction.recieving_currency_usd_rate;
      let recievingAmountAtMarketRate = transaction.amount_in_usd * recievingCurrency[0].market_usd_rate;

      // calc profit then convert to USD
      if (transaction.type === transactionType.BUY_CRYPTO) {
        profit += (recievingAmountAtSystemRate - recievingAmountAtMarketRate) / recievingCurrency[0].market_usd_rate;

      } else if (transaction.type === transactionType.CRYPTO_OFFRAMP) {
        profit += (recievingAmountAtMarketRate - recievingAmountAtSystemRate) / recievingCurrency[0].market_usd_rate;
      }
    }

    return profit;
  }

  public async calculateSingleTransactionProfitFromRate(txnId) {
    let profit = 0;
    let transactions = await Database.from('transactions')
      .where('status', transactionStatus.COMPLETED)
      .where('unique_id', txnId)
    if (transactions.length < 1) return 0;

    let recievingCurrency = await Database.from('currencies')
      .where('unique_id', transactions[0].reciever_currency_id)

    let recievingAmountAtSystemRate = transactions[0].amount_in_usd * transactions[0].recieving_currency_usd_rate;
    let recievingAmountAtMarketRate = transactions[0].amount_in_usd * recievingCurrency[0].market_usd_rate;

    // calc profit then convert to USD
    if (transactions[0].type === transactionType.BUY_CRYPTO) {
      profit = (recievingAmountAtSystemRate - recievingAmountAtMarketRate) / recievingCurrency[0].market_usd_rate;

    } else if (transactions[0].type === transactionType.CRYPTO_OFFRAMP) {
      profit = (recievingAmountAtMarketRate - recievingAmountAtSystemRate) / recievingCurrency[0].market_usd_rate;
    }

    return profit;
  }

}
