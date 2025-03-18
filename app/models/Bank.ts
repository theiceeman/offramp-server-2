import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'

export default class Bank extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public bankName: string

  @column()
  public paystackCode: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
