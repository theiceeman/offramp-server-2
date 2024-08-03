import { DateTime } from 'luxon'
import Admin from './Admin'
import User from './User'
import Currency from './Currency'
import { transactionStatus, transactionType } from 'App/helpers/types'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export default class Transaction extends BaseModel {

  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public type: transactionType

  @column()
  public userId: string

  @column()
  public status: transactionStatus


  @column()
  public senderCurrencyId: string

  @column()
  public recieverCurrencyId: string

  @column()
  public amountInUsd: number

  @column()
  public fee: number    // fee in USD

  @column()
  public walletAddress: string | null

  @column()
  public recievingWalletAddress: string | null

  @column()
  public sendingCurrencyUsdRate: number

  @column()
  public recievingCurrencyUsdRate: number

  @column()
  public transactionHash: string

  @column()
  public settlementProof: string

  @column()
  public processedBy: string

  @column()
  public settledBy: string

  @column()
  public settledAt: string | null

  @column()
  public fiatProviderTxRef: string | null

  @column()
  public fiatProviderResult: string

  @column()
  public isDeleted: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // processedBy -> admin_tb
  @belongsTo(() => Admin, {
    localKey: 'uniqueId',
    foreignKey: 'processedBy'
  })
  public admin: BelongsTo<typeof Admin>

  // userId -> user_tb
  @belongsTo(() => User, {
    localKey: 'uniqueId',
    foreignKey: 'userId'
  })
  public user: BelongsTo<typeof User>

  @belongsTo(() => Currency, {
    localKey: 'uniqueId',
    foreignKey: 'senderCurrencyId'
  })
  public sendingCurrency: BelongsTo<typeof Currency>

  @belongsTo(() => Currency, {
    localKey: 'uniqueId',
    foreignKey: 'recieverCurrencyId'
  })
  public recieverCurrency: BelongsTo<typeof Currency>
}

