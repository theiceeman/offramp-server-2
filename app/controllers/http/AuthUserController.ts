import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from "App/models/User";
import { schema, rules } from '@ioc:Adonis/Core/Validator'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils';


export default class AuthUserController {


  private async validate(request) {
    const transactionSchema = schema.create({
      password: schema.string([
        rules.confirmed(),
        rules.minLength(4)
      ]),
      email: schema.string([
        rules.email(),
        rules.unique({ table: 'users', column: 'email' })
      ]),
    })
    const messages = {
      required: 'The {{ field }} is required.',
      unique: 'This {{ field }} already exists.'
    }
    await request.validate({ schema: transactionSchema, messages });
  }

  public async signup({ request, response }: HttpContextContract) {
    try {
      const data = request.body();
      await this.validate(request)

      let result = await User.create({
        email: data.email,
        password: data.password,
      });

      if (result !== null) {
        response.status(200).json({ data: "User created!" });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async login({ auth, request, response }: HttpContextContract) {
    try {
      const email = request.input('email')
      const password = request.input('password')

      const token = await auth.use('user').attempt(email, password, {
        expiresIn: '12 hrs'  // 12 hrs
      })
      response.status(200).json({ data: token })
    } catch {
      response.status(400).json({ data: 'Invalid credentials!' })
    }
  }

  public async logout({ auth, response }: HttpContextContract) {
    try {
      await auth.use('user').revoke();
      response.status(200).json({ revoked: true });
    } catch (error) {
      response.status(400).json({ data: 'Failed to revoke token' });
    }
  }

  public async viewLoggedInUser({ response, auth }: HttpContextContract) {
    try {

      const user = auth.use('user').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      response.status(200).json({ data: user });
    } catch (error) {
      response.status(400).json({ data: error.message });
    }
  }


  public async updateLoggedInUser({
    response, request, auth
  }: HttpContextContract) {
    try {
      const data = request.body();

      const user = auth.use('user').user ?? '';
      if (!user)
        throw new Error('Please login!')

      let result = await User.query()
        .where('unique_id', user.uniqueId)
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          country: data.country
        })

      if (result === null) {
        throw new Error("Action failed!");
      } else {
        response.status(200).json(await formatSuccessMessage("Profile Updated.", null));
      }
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async viewSingleUser({
    response, auth, params
  }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN' && user.type !== 'ADMIN')
        throw new Error('Not authorized!')

      let result = await User.query()
        .where('unique_id', params.userId)

      if (result === null) {
        throw new Error("Action failed!");
      } else {
        response.status(200).json({ data: result });
      }
    } catch (error) {
      response.status(400).json({ data: error.message });
    }
  }


  public async blockUser({
    response, auth, params
  }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      let result = await User.query()
        .where('unique_id', params.userId)

      if (result[0].isBlocked === true)
        throw new Error('Account already blocked!')

      await User.query().where('unique_id', params.userId)
        .update({ is_blocked: true })

      response.status(200).json(await formatSuccessMessage("Account blocked.", null));
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }
  public async unblockUser({
    response, auth, params
  }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      let result = await User.query()
        .where('unique_id', params.userId)

      if (result[0].isBlocked === false)
        throw new Error('Account already unblocked!')

      await User.query().where('unique_id', params.userId)
        .update({ is_blocked: false })

      response.status(200).json(await formatSuccessMessage("Account unblocked.", null));

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


  public async viewAllUsers({ auth, response }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Not admin!')

      let data = await User.query()

      response.status(200).json({ data });
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

}


