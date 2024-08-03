import { roundToTwoDecimalPlace } from "App/helpers/utils";
import Currency from "App/models/Currency";
import Setting from "App/models/Setting";
import TransactionsController from "../controllers/http/TransactionsController";

export default class TransactionUtils {

  public async _calculateRatesForUserBuying(senderCurrencyId, recieverCurrencyId, amountInUsd, transactionType, amountType: 'sending' | 'receiving') {
    try {
      const sendingCurrency = await Currency.query().where('network', 'fiat').where('symbol', 'NGN')
      const recievingCurrency = await Currency.query().where('unique_id', recieverCurrencyId)
      const systemSetting = await Setting.firstOrFail()

      let transactionFee = systemSetting.transactionFeePercentage === 0
        ? 0 : (amountInUsd * systemSetting.transactionFeePercentage) / 100

      let sendingCurrencyUsdRate, recievingCurrencyUsdRate;
      if (amountType === 'sending') {
        let sellRateMargin = (systemSetting.sellRatePercentage * Number(recievingCurrency[0].marketUsdRate)) / 100;
        recievingCurrencyUsdRate = roundToTwoDecimalPlace(Number(recievingCurrency[0].marketUsdRate) + sellRateMargin);
        sendingCurrencyUsdRate = Number(sendingCurrency[0].marketUsdRate);

      } else if (amountType === 'receiving') {
        let sellRateMargin = (systemSetting.sellRatePercentage * Number(sendingCurrency[0].marketUsdRate)) / 100;
        recievingCurrencyUsdRate = Number(recievingCurrency[0].marketUsdRate);
        sendingCurrencyUsdRate = roundToTwoDecimalPlace(Number(sendingCurrency[0].marketUsdRate) + sellRateMargin);

      } else {
        throw new Error('Amount Type must be sending or receiving')
      }

      let result = [{
        type: transactionType,
        amountInUsd,
        senderCurrencyId: senderCurrencyId,
        recieverCurrencyId: recieverCurrencyId,
        sendingCurrencyUsdRate,
        recievingCurrencyUsdRate,
        fee: transactionFee,   // fee in USD
        actual_amount_user_sends: 0,
        actual_amount_user_receives: 0,
      }]

      if (amountType === 'sending') {
        result[0].actual_amount_user_receives = new TransactionsController()._calcActualAmountUserRecieves(result, 'userBuy');
        result[0].actual_amount_user_sends = amountInUsd * sendingCurrencyUsdRate;

      } else if (amountType === 'receiving') {
        result[0].actual_amount_user_receives = amountInUsd * recievingCurrencyUsdRate;
        result[0].actual_amount_user_sends = new TransactionsController()._calcActualAmountUserSendsDuringValidation(result, 'userBuy');

      } else {
        throw new Error('Amount Type must be sending or receiving')
      }
      // console.log({ result })

      return result;
    } catch (error) {
      throw new Error(error.message)
    }
  }

  public async _calculateRatesForUserSelling(senderCurrencyId, recieverCurrencyId, amountInUsd, transactionType, amountType) {
    try {
      let sendingCurrency = await Currency.query().where('unique_id', senderCurrencyId)
      let recievingCurrency = await Currency.query().where('network', 'fiat').where('symbol', 'NGN')
      let systemSetting = await Setting.firstOrFail()

      //  calculate transaction fee
      let transactionFee = systemSetting.transactionFeePercentage === 0
        ? 0 : (amountInUsd * systemSetting.transactionFeePercentage) / 100

      // calculate our buy rates
      let sendingCurrencyUsdRate, recievingCurrencyUsdRate;
      if (amountType === 'sending') {
        let buyRateMargin = (systemSetting.buyRatePercentage * Number(recievingCurrency[0].marketUsdRate)) / 100;
        recievingCurrencyUsdRate = roundToTwoDecimalPlace(Number(recievingCurrency[0].marketUsdRate) - buyRateMargin);
        sendingCurrencyUsdRate = Number(sendingCurrency[0].marketUsdRate);

      } else if (amountType === 'receiving') {
        let buyRateMargin = (systemSetting.buyRatePercentage * Number(sendingCurrency[0].marketUsdRate)) / 100;
        recievingCurrencyUsdRate = Number(recievingCurrency[0].marketUsdRate);
        sendingCurrencyUsdRate = roundToTwoDecimalPlace(Number(sendingCurrency[0].marketUsdRate) - buyRateMargin);

      } else {
        throw new Error('Amount Type must be sending or receiving')
      }

      let result = [{
        type: transactionType,
        amountInUsd: amountInUsd,
        senderCurrencyId: senderCurrencyId,
        recieverCurrencyId: recieverCurrencyId,
        sendingCurrencyUsdRate,
        recievingCurrencyUsdRate,
        fee: transactionFee,   // fee in USD
        actual_amount_user_sends: 0,
        actual_amount_user_receives: 0,
      }]

      // calculate actual amount user recieves and sends in the selected currencies.
      if (amountType === 'sending') {
        result[0]['actual_amount_user_receives'] = new TransactionsController()._calcActualAmountUserRecieves(result, 'userSell');
        result[0]['actual_amount_user_sends'] = amountInUsd / sendingCurrencyUsdRate;

      } else if (amountType === 'receiving') {
        result[0]['actual_amount_user_receives'] = amountInUsd / recievingCurrencyUsdRate;
        result[0]['actual_amount_user_sends'] = new TransactionsController()._calcActualAmountUserSendsDuringValidation(result, 'userSell');

      } else {
        throw new Error('Amount Type must be sending or receiving')
      }

      return result;
    } catch (error) {
      throw new Error(error.message)
    }

  }
}
