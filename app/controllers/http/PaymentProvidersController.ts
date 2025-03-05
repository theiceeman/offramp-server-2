// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import { supportedChains, transactionProcessingType, userPaymentType } from "App/helpers/types";
import { genRandomUuid, isTestNetwork } from "App/helpers/utils";
import OffRampWallet from "App/lib/contract-wallet/OffRampWallet";
import Flutterwave from "App/lib/fiat-provider/Flutterwave";
import Paystack from "App/lib/fiat-provider/Paystack";
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
      let paymentDetails: any = {};


      if (systemSetting.transactionProcessingType === transactionProcessingType.AUTO) {
        const paystack = new Paystack(isTestTransaction ? 'dev' : 'prod');
        const result = await paystack.initializePayment(
          fiatProviderTxRef,
          String(actualAmountUserSends),
          user[0].email,
          paymentType
        );

        if (paymentType === userPaymentType.BANK_TRANSFER) {
          paymentDetails = {
            defaultAccountBank: result.data.bank,
            defaultAccountNo: result.data.account_number,
            defaultAccountName: result.data.account_name,
          };
        } else if (paymentType === userPaymentType.DEBIT_CARD) {
          paymentDetails = {
            authorizationUrl: result.data.authorization_url,
            accessCode: result.data.access_code,
            reference: result.data.reference,
            publicKey: result.data.public_key
          };
        }
      } else {
        // Manual processing
        paymentDetails = {
          defaultAccountBank: systemSetting.defaultAccountBank,
          defaultAccountNo: systemSetting.defaultAccountNo,
          defaultAccountName: systemSetting.defaultAccountName
        };
      }

      return { fiatProviderTxRef, paymentDetails }
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
