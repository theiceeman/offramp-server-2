import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Setting extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public enforceKyc: boolean

  @column()
  public transactionFeePercentage: number

  @column()
  public buyRatePercentage: number

  @column()
  public sellRatePercentage: number

  @column()
  public systemProfitPercentage: number

  @column()
  public lpProfitPercentage: number

  @column()
  public transactionProcessingType: string

  @column()
  public defaultAccountBank: string

  @column()
  public defaultAccountName: string

  @column()
  public defaultAccountNo: string

  @column()
  public minTransactionAmount: number

  @column()
  public maxTransactionAmount: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
