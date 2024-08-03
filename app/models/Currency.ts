import { DateTime } from 'luxon'
import { BaseModel, HasMany, column, hasMany } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import Transaction from './Transaction'

export default class Currency extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public type: string  // crypto, fiat

  @column()
  public network: string  // fiat, bsc, fiat, bsc, bsc

  @column()
  public name: string

  @column()
  public symbol: string   // ngn, usdt, bnb, usd, link

  @column()
  public logo: string

  @column()
  public marketUsdRate: number

  @column()
  public tokenAddress: string

  @column()
  public isBlocked: string

  @column()
  public isDeleted: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @hasMany(() => Transaction, {
    localKey: 'uniqueId',
    foreignKey: 'senderCurrencyId',
  })
  public transactions: HasMany<typeof Transaction>

  @hasMany(() => Transaction, {
    localKey: 'uniqueId',
    foreignKey: 'recieverCurrencyId',
  })
  public _transactions: HasMany<typeof Transaction>
}
