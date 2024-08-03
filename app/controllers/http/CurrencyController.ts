import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { schema } from '@ioc:Adonis/Core/Validator'
import Currency from 'App/models/Currency';
import CurrencyRatesController from './CurrencyRatesController';
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils';
import Database from '@ioc:Adonis/Lucid/Database';


export default class CurrencyController {

  private async validate(request) {
    const transactionSchema = schema.create({
      type: schema.string({ trim: true }),
      network: schema.string({ trim: true }),
      name: schema.string({ trim: true }),
      symbol: schema.string({ trim: true }),
      logo: schema.string({ trim: true }),
      tokenAddress: schema.string({ trim: true }),
    })
    const messages = {
      required: 'The {{ field }} is required.'
    }
    await request.validate({ schema: transactionSchema, messages });
  }

  public async createCurrency({ request, response, auth }: HttpContextContract) {
    try {
      await this.validate(request)

      const data = request.body();
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      let symbol = (String(data.symbol)).toUpperCase();
      let currency = await Currency.query().where('name', data.name)
        .where('symbol', symbol).where('network', data.network)
        .where('type', data.type)
      if (currency.length > 0)
        throw new Error('Currency already exists!')

      // creating crypto-currency should include tokenAddress
      if (data.type === 'crypto' && typeof data.tokenAddress !== 'string') {
        throw new Error('Token address is required, for cryptocurrency!')
      }

      let marketUsdRate;
      if (data.type === 'crypto')
        marketUsdRate = await new CurrencyRatesController()
          .getCryptoUsdRate(symbol);
      else if (data.type === 'fiat')
        marketUsdRate = await new CurrencyRatesController()
          .getFiatUsdRate(symbol);

      let result = await Currency.create({
        type: data.type,
        network: data.network,
        name: data.name,
        symbol,
        logo: data.logo,
        marketUsdRate,
        tokenAddress: data?.tokenAddress
      });

      if (result !== null) {
        response.status(200).json({ data: "Currency created." });
      } else {
        throw new Error("Currency creation failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async update({ request, response, auth, params }: HttpContextContract) {
    try {
      const data = request.body();
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      let currency = await Database.from('currencies')
        .where('unique_id', params.currencyId)
        .firstOrFail()

      let marketUsdRate;
      if (currency.type === 'crypto')
        marketUsdRate = await new CurrencyRatesController().getCryptoUsdRate(data.symbol);
      else if (currency.type === 'fiat')
        marketUsdRate = await new CurrencyRatesController().getFiatUsdRate(data.symbol);


      let result = await Currency.query()
        .where('unique_id', params.currencyId)
        .update({
          name: data?.name ?? currency.name,
          symbol: data?.symbol ?? currency.symbol,
          logo: data?.logo ?? currency.logo,
          marketUsdRate,
        })

      if (result !== null) {
        response.status(200).json({ data: "Currency updated!" });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async deleteCurrency({ response, auth, params }: HttpContextContract) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')

      let result = await Currency.query()
        .where('unique_id', params.currencyId)
        .update({ is_deleted: true })

      if (result === null) {
        throw new Error("Action failed!");
      } else {
        response.status(200).json(await formatSuccessMessage("Currency deleted.",null));
      }
    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  public async viewCurrenciesAsUser({ response }: HttpContextContract) {
    try {
      let data = await Currency.query()
        .where('is_blocked', false)
        .where('is_deleted', false)

      response.status(200).json({ data });
    } catch (error) {
      response.status(400).json({ data: error.message });
    }
  }

  public async viewCurrenciesAsAdmin({ response }: HttpContextContract) {
    try {
      let data = await Currency.query().orderBy('name', 'desc')

      response.status(200).json({ data });
    } catch (error) {
      response.status(400).json({ data: error.message });
    }
  }


}
