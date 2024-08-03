import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import RolesController from './RolesController';
import { supportedChains } from 'App/helpers/types';
import Currency from 'App/models/Currency';
import OffRampWallet from 'App/lib/contract-wallet/OffRampWallet';
import UserWallet from 'App/models/UserWallet';
import { formatErrorMessage } from 'App/helpers/utils';


export default class UserWalletsController extends RolesController {

  /**
   * Calcualte the total balance in single or all users individual wallets.
   * @param param0
   */
  public async viewTotalCurrenciesBalance({ response, auth }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);
      const _supportedChains = Object.values(supportedChains).filter((e: any) => e !== 'local');

      let balances: Array<Object> = []
      for (const chain of _supportedChains) {

        let cryptoCurrency = await Currency.query()
          .where("type", "crypto")
          .where("network", chain)
          .where("is_deleted", false);

        for (const currency of cryptoCurrency) {
          let totalBalance = 0;

          let activeWallets = await UserWallet.query()
            .where("network", currency.network)
            .where("is_deleted", false)

          for (const wallet of activeWallets) {

            let balance = await new OffRampWallet(chain as unknown as supportedChains, wallet.walletAddress).cloneWalletTokenBalance(currency.tokenAddress)
            totalBalance += Number(balance)
          }
          balances.push({
            symbol: currency.symbol,
            balance: totalBalance,
            network: currency.network
          })
        }
      }

      response.status(200).json({ data: balances });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async viewBalance({ response, auth, params }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);
      const _supportedChains = Object.values(supportedChains).filter((e: any) => e !== 'local');

      let balances: Array<Object> = []
      for (const chain of _supportedChains) {

        let activeWallets = await UserWallet.query()
          .where("network", chain)
          .where("is_deleted", false)
          .where("user_id", params.userId);

        for (const wallet of activeWallets) {
          let cryptoCurrency = await Currency.query()
            .where("type", "crypto")
            .where("network", chain)
            .where("is_deleted", false);

          let userWallet: Array<Object> = []

          for (const currency of cryptoCurrency) {
            let totalBalance = 0;

            let balance = await new OffRampWallet(chain as unknown as supportedChains, wallet.walletAddress).cloneWalletTokenBalance(currency.tokenAddress)
            totalBalance += Number(balance)

            userWallet.push({
              wallet: wallet.walletAddress,
              symbol: currency.symbol,
              balance: totalBalance,
              network: currency.network
            })

          }
          balances.push(userWallet)
        }

      }

      response.status(200).json({ data: balances });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


}
