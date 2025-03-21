import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'user_fiat_accounts'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('user_id', 255).notNullable()
      table.string('account_name', 255).notNullable()
      table.string('account_no', 255).notNullable()
      table.string('bank_id').references('unique_id').inTable('banks')

      table.boolean('is_deleted').notNullable().defaultTo(false)

      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
