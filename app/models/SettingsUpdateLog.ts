import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class SettingsUpdateLog extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public requestBody: string

  @column()
  public userId: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime
}
