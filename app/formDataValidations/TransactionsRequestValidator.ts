
import { schema } from '@ioc:Adonis/Core/Validator'
import { iValidateBuyResponse, iValidateRatesResponse, iValidateSellResponse } from 'App/types/TransactionsController.types';



export default class TransactionsRequestValidator {

  public async validateBuyTransaction(request: any) {
    const Schema = schema.create({
      paymentType: schema.string({ trim: true }), //  bank transfer or debit card
      amountInUsd: schema.number(),
      recievingWalletAddress: schema.string({ trim: true }),
      recieverCurrencyId: schema.string({ trim: true }),
      senderCurrencyId: schema.string({ trim: true }),
    })

    const messages = {
      required: 'The {{ field }} is required.'
    }
    return await request.validate({ schema: Schema, messages }) as iValidateBuyResponse;
  }

  public async validateSellTransaction(request: any) {
    const Schema = schema.create({
      amountInUsd: schema.number(),
      recieverCurrencyId: schema.string({ trim: true }),
      senderCurrencyId: schema.string({ trim: true }),
    })

    const messages = {
      required: 'The {{ field }} is required.'
    }
    return await request.validate({ schema: Schema, messages }) as iValidateSellResponse;
  }


  public async validateRatesCalculation(request: any) {
    const Schema = schema.create({
      amountInUsd: schema.number(),
      amountType: schema.string(),
      senderCurrencyId: schema.string({ trim: true }),
      recieverCurrencyId: schema.string({ trim: true }),
    })

    const messages = {
      required: 'The {{ field }} is required.'
    }
    return await request.validate({ schema: Schema, messages }) as iValidateRatesResponse;
  }


}
