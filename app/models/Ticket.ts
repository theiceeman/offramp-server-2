import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, beforeCreate, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import { genRandomUuid } from 'App/helpers/utils'
import Admin from './Admin'
import User from './User'

export default class Ticket extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public uniqueId: string

  @column()
  public mainId: string

  @column()
  public userId: string | null

  @column()
  public adminId: string | null

  @column()
  public title: string

  @column()
  public message: string

  @column()
  public main: boolean

  @column()
  public status: string //  open | closed

  @column()
  public isDeleted: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => Admin, {
    localKey: 'uniqueId',
    foreignKey: 'adminId'
  })
  public admin: BelongsTo<typeof Admin>

  @belongsTo(() => User, {
    localKey: 'uniqueId',
    foreignKey: 'userId'
  })
  public user: BelongsTo<typeof User>

  @beforeCreate()
  public static async saveMainTicket(ticket: Ticket) {
    if (ticket.$dirty.main === true) {
      let uniqueId = genRandomUuid()
      ticket.uniqueId = uniqueId
      ticket.mainId = uniqueId
    } else {
      let uniqueId = genRandomUuid()
      ticket.uniqueId = uniqueId
    }

  }
}
