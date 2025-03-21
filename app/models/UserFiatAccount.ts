import { DateTime } from 'luxon'
import { BaseModel, column, HasOne, hasOne } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import Bank from './Bank'

export default class UserFiatAccount extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public userId: string

  @column()
  public accountName: string

  @column()
  public accountNo: string

  @column()
  public bankId: string

  @column()
  public isDeleted: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime


  @hasOne(() => Bank, {
    localKey: 'bankId',
    foreignKey: 'uniqueId',
  })
  public bank: HasOne<typeof Bank>
}
