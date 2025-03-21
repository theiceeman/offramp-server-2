import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { schema } from '@ioc:Adonis/Core/Validator'
import UserFiatAccount from 'App/models/UserFiatAccount';
import RolesController from './RolesController';
import { formatErrorMessage } from 'App/helpers/utils';
import Bank from 'App/models/Bank';


export default class FiatAccountController extends RolesController {

  private async validate(request) {
    const transactionSchema = schema.create({
      accountName: schema.string({ trim: true }),
      accountNo: schema.string({ trim: true }),
      bankId: schema.string({ trim: true }),
    })
    const messages = {
      required: 'The {{ field }} is required.'
    }
    await request.validate({ schema: transactionSchema, messages });
  }

  public async create({ request, response, auth }: HttpContextContract) {
    try {
      const data = request.body();
      await this.validate(request)

      let uniqueId = await this.allowOnlyLoggedInUsers(auth)

      let bankExists = await Bank.query().where('unique_id', data.bankId)
      if (bankExists.length < 1) {
        throw new Error('Bank Id does not exist')
      }

      let accountExists = await UserFiatAccount.query()
        .where('user_id', uniqueId)

      let result;
      if (accountExists.length > 0) {
        result = await UserFiatAccount.query()
          .where('user_id', uniqueId)
          .update({
            accountName: data.accountName,
            accountNo: data.accountNo,
            bankId: data.bankId,
          })

      } else {
        result = await UserFiatAccount.create({
          userId: auth.use('user').user?.uniqueId,
          accountName: data.accountName,
          accountNo: data.accountNo,
          bankId: data.bankId,
        });
      }

      if (result !== null) {
        response.status(200).json({ data: "Fiat Account saved!" });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async viewUsersAccounts({ auth, response }: HttpContextContract) {
    try {
      let uniqueId = await this.allowOnlyLoggedInUsers(auth)

      let data = await UserFiatAccount.query()
        .preload('bank', (query) => query.select('bankName', 'unique_id', 'paystackCode'))
        .where('user_id', uniqueId)
        .where('is_deleted', false)

      response.status(200).json({ data });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async viewUsersAccountAsAdmin({ auth, response, params }: HttpContextContract) {
    try {
      this.allowOnlySuperAdmins(auth);

      let data = await UserFiatAccount.query()
        .preload('bank', (query) => query.select('bankName', 'unique_id', 'paystackCode'))
        .where('user_id', params.userId)

      response.status(200).json({ data });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async deleteAccount({ auth, response }: HttpContextContract) {
    try {
      let uniqueId = await this.allowOnlyLoggedInUsers(auth)

      let result = await UserFiatAccount.query()
        .where('user_id', uniqueId)
        .update({ is_deleted: true })

      if (result !== null) {
        response.status(200).json({ data: "Fiat Account deleted!" });
      } else {
        throw new Error("Action failed!");
      }
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async supportedBanks({ auth, response }: HttpContextContract) {
    try {
      const uniqueId = auth.use('user').user?.uniqueId ?? '';
      if (!uniqueId)
        throw new Error('Authentication error!')

      let result = await Bank.query()

      if (result !== null) {
        response.status(200).json({ data: result });
      } else {
        throw new Error("Action failed!");
      }
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async checkIfUserHasBankAccount(userUniqueId) {
    try {
      let fiatAccount = await UserFiatAccount.query()
        .where('user_id', userUniqueId).where('is_deleted', false)

      if (fiatAccount.length < 1)
        throw new Error('To proceed, add a bank account in settings.')
    } catch (error) {
      throw new Error(error.message)
    }
  }

}
