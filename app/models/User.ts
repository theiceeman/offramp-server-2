import { DateTime } from 'luxon'
import Hash from '@ioc:Adonis/Core/Hash'
import { BaseModel, HasMany, beforeSave, column, hasMany } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from '../helpers/utils'
import Transaction from './Transaction'
import Ticket from './Ticket'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string = genRandomUuid()

  @column()
  public firstName: string

  @column()
  public lastName: string

  @column()
  public country: string

  @column()
  public email: string

  @column()
  public password: string

  @column()
  public isBlocked: boolean

  @column()
  public isDeleted: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password)
    }
  }

  // user -> transactions
  @hasMany(() => Transaction, {
    localKey: 'uniqueId',
    foreignKey: 'userId',
  })
  public transactions: HasMany<typeof Transaction>

  @hasMany(() => Ticket, {
    localKey: 'uniqueId',
    foreignKey: 'userId',
  })
  public tickets: HasMany<typeof Ticket>
}
