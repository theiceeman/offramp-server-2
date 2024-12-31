// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import { supportedChains, transactionProcessingType, userPaymentType } from "App/helpers/types";
import { genRandomUuid, isTestNetwork } from "App/helpers/utils";
import OffRampWallet from "App/lib/contract-wallet/OffRampWallet";
import Flutterwave from "App/lib/fiat-provider/Flutterwave";
import Currency from "App/models/Currency";
import Setting from "App/models/Setting";
import User from "App/models/User";
import UserWallet from "App/models/UserWallet";

export default class PaymentProvidersController {

  public async processSelectedFiatPaymentMethod(receivingCurrencyId, paymentType, actualAmountUserSends, userId) {
    try {
      const user = await User.query().where('unique_id', userId)
      if (!user) {
        throw new Error('User not found');
      }
      const recievingCurrency = await Currency.query().where('unique_id', receivingCurrencyId)
      const systemSetting = await Setting.firstOrFail()

      let isTestTransaction = isTestNetwork(recievingCurrency[0].network)
      let fiatProviderTxRef = genRandomUuid();
      let bankToProcessTransaction = {
        defaultAccountBank: '',
        defaultAccountNo: '',
        defaultAccountName: ''
      };

      if (paymentType === userPaymentType.DEBIT_CARD) {
        // We charge their debit card directly.
      }
      if (paymentType === userPaymentType.BANK_TRANSFER) {

        if (systemSetting.transactionProcessingType === transactionProcessingType.AUTO) {
          let result = await new Flutterwave(isTestTransaction ? 'dev' : 'prod')
            .generateBankAccount(fiatProviderTxRef, String(actualAmountUserSends), user[0].email)

          bankToProcessTransaction.defaultAccountBank = result?.meta?.authorization?.transfer_bank;
          bankToProcessTransaction.defaultAccountNo = result?.meta?.authorization?.transfer_account;
        } else {
          bankToProcessTransaction.defaultAccountBank = systemSetting.defaultAccountBank;
          bankToProcessTransaction.defaultAccountNo = systemSetting.defaultAccountNo;
        }

      }

      return { fiatProviderTxRef, bankToProcessTransaction }
    } catch (error) {
      throw new Error(error.message)
    }
  }

  public async processCryptoPaymentMethod(userUniqueId, senderCurrencyId) {
    try {
      let sendingCurrency = await Currency.query().where('unique_id', senderCurrencyId)

      let txnWalletAddress;
      let wallet = await UserWallet.query().where('user_id', userUniqueId)
        .where('network', sendingCurrency[0].network).where('is_deleted', false)

      // if user doesnt have a contract wallet supporting the sending currency network,
      // we create one for them.
      if (wallet.length < 1) {
        let result = await new OffRampWallet(supportedChains[sendingCurrency[0].network])
          .factoryDeployAddress(String(Date.now()));


        await UserWallet.create({
          userId: userUniqueId,
          network: sendingCurrency[0].network,
          walletAddress: result.data[1].value,
        })

        txnWalletAddress = result.data[1].value;
      } else {
        txnWalletAddress = wallet[0].walletAddress
      }
      return txnWalletAddress
    } catch (error) {
      throw new Error(error.message)
    }
  }


}
