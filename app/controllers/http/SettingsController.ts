import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Setting from "App/models/Setting";
import SettingsUpdateLog from 'App/models/SettingsUpdateLog';
import { formatErrorMessage } from 'App/helpers/utils';

export default class SettingsController {

  public async update({ request, response, auth }: HttpContextContract) {
    try {
      const data = request.body();
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      if (data?.lp_profit_percentage && data?.system_profit_percentage) {
        if ((data?.lp_profit_percentage + data?.system_profit_percentage) !== 100)
          throw new Error('System & lp providers percentage should equal 100!')
      }

      let setting = await Setting.firstOrFail()
      let result = await Setting.query()
        .where('id', 1)
        .update({
          enforce_kyc: data?.enforce_kyc ?? setting.enforceKyc,
          transaction_fee_percentage: data?.transaction_fee_percentage ?? setting.transactionFeePercentage,
          buy_rate_percentage: data?.buy_rate_percentage ?? setting.buyRatePercentage,
          sell_rate_percentage: data?.sell_rate_percentage ?? setting.sellRatePercentage,
          system_profit_percentage: data?.system_profit_percentage ?? setting.systemProfitPercentage,
          lp_profit_percentage: data?.lp_profit_percentage ?? setting.lpProfitPercentage,
          transaction_processing_type: data?.transaction_processing_type ?? setting.transactionProcessingType,
          default_account_bank: data?.default_account_bank ?? setting.defaultAccountBank,
          default_account_name: data?.default_account_name ?? setting.defaultAccountName,
          default_account_no: data?.default_account_no ?? setting.defaultAccountNo,
          min_transaction_amount: data?.min_transaction_amount ?? setting.minTransactionAmount,
          max_transaction_amount: data?.max_transaction_amount ?? setting.maxTransactionAmount,
        })

      await SettingsUpdateLog.create({
        requestBody: JSON.stringify(data),
        userId: user.uniqueId
      })

      if (result !== null) {
        response.status(200).json({ data: "Settings updated!" });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async viewSettingsAdmin({ auth, response }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Not admin!')

      let data = await Setting.query().where('id', 1)
        .select(
          'enforce_kyc', 'transaction_fee_percentage', 'buy_rate_percentage',
          'sell_rate_percentage', 'system_profit_percentage', 'lp_profit_percentage',
          'transaction_processing_type', 'default_account_bank', 'default_account_no',
          'default_account_name','min_transaction_amount','max_transaction_amount'
        )

      response.status(200).json({ data: data[0] });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
  public async viewSettingsUser({ auth, response }: HttpContextContract) {
    try {
      const user = auth.use('user').user ?? '';
      if (!user)
        throw new Error('Not user!')

      let data = await Setting.query().where('id', 1)
        .select('transaction_fee_percentage')

      response.status(200).json({ data: data[0] });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

}
