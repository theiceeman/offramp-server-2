import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'currencies'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('type', 255).notNullable()
      table.string('network', 255).notNullable()
      table.string('name', 255).notNullable()
      table.string('symbol', 255).notNullable()
      table.text('logo').notNullable()
      table.decimal('market_usd_rate', null).nullable()
      table.string('token_address').nullable()
      table.boolean('is_blocked').notNullable().defaultTo(false)
      table.boolean('is_deleted').notNullable().defaultTo(false)

      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
