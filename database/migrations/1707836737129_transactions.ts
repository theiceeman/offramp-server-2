import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('unique_id', 255).notNullable().unique()
      table.string('type', 255).notNullable()
      table.string('user_id', 255).notNullable().references('unique_id').inTable('users')
      table.string('status', 255).notNullable()
      table.string('sender_currency_id', 255).notNullable().references('unique_id').inTable('currencies')
      table.string('reciever_currency_id', 255).notNullable().references('unique_id').inTable('currencies')
      table.decimal('amount_in_usd', 20, 16).notNullable()
      table.float('fee').notNullable()    // fee in USD
      table.string('wallet_address', 255).nullable()
      table.string('recieving_wallet_address', 255).nullable()
      table.decimal('sending_currency_usd_rate', null).notNullable()  // usd_token price at market rate (eg 1 USD = 0.0000147 BTC
      table.decimal('recieving_currency_usd_rate', null).notNullable()  // usd_ngn price at our rate (eg 1 USD = 1450 NGN)
      table.string('transaction_hash', 255).nullable()
      table.string('settlement_proof', 255).nullable()
      table.string('processed_by', 255).nullable()
      table.string('settled_by', 255).nullable().references('unique_id').inTable('admins')
      table.string('settled_at', 255).nullable()
      table.string('fiat_provider_tx_ref', 255).notNullable()
      table.text('fiat_provider_result').nullable()
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
