import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import Transaction from './Transaction'

export default class SocketConnection extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public socketConnectionId: string

  @column()
  public transactionId: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Transaction, {
    localKey: 'uniqueId',
    foreignKey: 'transactionId'
  })
  public transaction: BelongsTo<typeof Transaction>
}

