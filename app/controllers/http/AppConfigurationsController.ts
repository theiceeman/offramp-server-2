import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { currencyNetwork, supportedChains, transactionProcessingType, transactionStatus } from 'App/helpers/types'
import { roundToTwoDecimalPlace } from 'App/helpers/utils';
import Currency from 'App/models/Currency'
import Setting from 'App/models/Setting'

export default class AppConfigurationsController {

  public async admin({ response, auth }: HttpContextContract) {
    let user = auth.use('admin').user;
    if (!user?.uniqueId)
      throw new Error('Authentication error!')
    let settings = await Setting.query().where('id', 1)
    let ngn = await Currency.query().where('symbol', 'NGN')
      .where('network', 'fiat').where('is_deleted', false)

    let buyRatePercentage = (settings[0].buyRatePercentage * Number(ngn[0].marketUsdRate)) / 100;
    let sellRatePercentage = (settings[0].sellRatePercentage * Number(ngn[0].marketUsdRate)) / 100;

    let data = {
      ADMIN_TYPE: [
        'SUPER_ADMIN', 'ADMIN', 'LP'
      ],
      CURRENCY_TYPE: [
        'crypto', 'fiat'
      ],
      CURRENCY_NETWORK: [
        currencyNetwork
      ],
      SUPPORTED_CRYPTO_NETWORK: [
        supportedChains
      ],
      TRANSACTION_STATUS: [
        transactionStatus
      ],
      TRANSACTION_PROCESSING_TYPE: [
        transactionProcessingType
      ],
      USD_NGN_MARKET_RATE: Number(ngn[0].marketUsdRate),
      USD_NGN_BUY_RATE: roundToTwoDecimalPlace(Number(ngn[0].marketUsdRate) - buyRatePercentage),
      USD_NGN_SELL_RATE: roundToTwoDecimalPlace(Number(ngn[0].marketUsdRate) + sellRatePercentage),
    }

    response.status(200).json(data)

  }
  public async user({ response }: HttpContextContract) {
    // let user = auth.use('user').user;
    // if (!user?.uniqueId)
    //   throw new Error('Authentication error!')

    let settings = await Setting.query().where('id', 1)
    let ngn = await Currency.query().where('symbol', 'NGN')
      .where('network', 'fiat').where('is_deleted', false)

    let buyRatePercentage = (settings[0].buyRatePercentage * Number(ngn[0].marketUsdRate)) / 100;
    let sellRatePercentage = (settings[0].sellRatePercentage * Number(ngn[0].marketUsdRate)) / 100;

    let data = {
      USD_NGN_MARKET_RATE: Number(ngn[0].marketUsdRate),
      USD_NGN_BUY_RATE: roundToTwoDecimalPlace(Number(ngn[0].marketUsdRate) - buyRatePercentage),
      USD_NGN_SELL_RATE: roundToTwoDecimalPlace(Number(ngn[0].marketUsdRate) + sellRatePercentage),
    }

    response.status(200).json(data)

  }
}
