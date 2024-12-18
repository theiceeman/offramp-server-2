import BaseSchema from '@ioc:Adonis/Lucid/Schema'
import { transactionProcessingType } from 'App/helpers/types'

export default class extends BaseSchema {
    protected tableName = 'settings'

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id')
            table.boolean('enforce_kyc').notNullable()
            table.float('transaction_fee_percentage', 255).notNullable()    // percentage charged per transaction fee
            table.float('buy_rate_percentage', 255).notNullable()   //  percentage subtracted from market api rate
            table.float('sell_rate_percentage', 255).notNullable()   //  percentage added to market api rate
            table.float('system_profit_percentage', 255).notNullable() // system percentage from profit per transaction
            table.float('lp_profit_percentage', 255).notNullable()  // lp(s) percentage from profit per transaction
            table.text('transaction_processing_type').notNullable()  // how system processes transactions
            table.string('default_account_bank', 255).notNullable()
            table.string('default_account_no', 255).notNullable()
            table.string('default_account_name', 255).notNullable()
            table.float('min_transaction_amount', 255).notNullable()  // in usd
            table.float('max_transaction_amount', 255).notNullable()  // in usd

            /**
             * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
             */
            table.timestamp('created_at', { useTz: true })
            table.timestamp('updated_at', { useTz: true })
        })

        // Insert a row into the settings table
        this.defer(async (db) => {
            await db.table(this.tableName).insert({
                id: 1,
                enforce_kyc: false,
                transaction_fee_percentage: 0,
                buy_rate_percentage: 3,
                sell_rate_percentage: 3,
                system_profit_percentage: 30,
                lp_profit_percentage: 70,
                transaction_processing_type: transactionProcessingType.MANUAL,
                default_account_bank: 'Moniepoint Bank',
                default_account_no: '4293826673',
                default_account_name: 'Imperionix Tech Ltd.',
                min_transaction_amount: 1,
                max_transaction_amount: 10000,
                created_at: new Date(),
                updated_at: new Date(),
            })

        })
    }

    public async down() {
        this.schema.dropTable(this.tableName)
    }
}
