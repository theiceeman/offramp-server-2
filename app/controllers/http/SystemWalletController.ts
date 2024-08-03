import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { supportedChains } from 'App/helpers/types';
import { formatErrorMessage } from 'App/helpers/utils';
import SystemWallet from 'App/lib/system-wallet/SystemWallet';
import Currency from 'App/models/Currency';
import RolesController from './RolesController';

export default class SystemWalletController extends RolesController {

  /**
   * View main system wallet address.
   * @param param0
   */
  public async viewAddress({ response, auth }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);

      let data = await new SystemWallet(supportedChains.bsc).address()

      response.status(200).json({ data });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * View native coin balance of system wallet address across supported chains.
   * @param param0
   */
  public async viewNativeCoinBalance({ response, auth }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);
      const _supportedChains = Object.values(supportedChains).filter((e: any) => e !== 'local');

      let balances: Array<Object> = []
      for (const chain of _supportedChains) {
        let balance = await new SystemWallet(chain as unknown as supportedChains).nativeCoinbalance()
        balances.push({ [chain]: balance });
      }

      response.status(200).json({ data: balances });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * View balance of supported currencies in system wallet.
   * @param param0
   */
  public async viewCurrenciesBalance({ response, auth }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);

      const _supportedChains = Object.values(supportedChains).filter((e: any) => e !== 'local');

      let balances: Object = {}
      for (const chain of _supportedChains) {
        let balance = await new SystemWallet(chain as unknown as supportedChains).viewBalances()
        balances[chain] = balance;
      }

      response.status(200).json({ data: balances });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * Flush tokens in individual user wallets to main system wallet.
   * @param param0
   */
  public async flushTokens({ response, request, auth }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);
      const data = request.body();

      await new SystemWallet(data.network as unknown as supportedChains)
        .flushTokensToSystemWallet()

      response.status(200).json({ data: "Migration completed." });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  /**
   * Withdraw tokens from system wallet.
   * @param param0
   */
  public async withdrawToken({ response, request, auth }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);
      const data = request.body();

      let cryptoCurrency = await Currency.query()
        .where("type", "crypto")
        .where("unique_id", data.currencyId)
        .where("is_deleted", false);

      await new SystemWallet(cryptoCurrency[0].network as unknown as supportedChains)
        .withdraw(data.amount, cryptoCurrency[0].tokenAddress, data?.withdrawToAddress)

      response.status(200).json({ data: "Withdrawal completed." });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


}
