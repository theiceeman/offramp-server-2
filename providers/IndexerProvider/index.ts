import type { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { transactionStatus, transactionType } from 'App/helpers/types'
// import TransactionIndexer from 'App/Lib/indexer/Indexer'
// import Transaction from 'App/Models/Transaction'
// import { supportedChains } from 'App/Controllers/types';

/*
|--------------------------------------------------------------------------
| Provider
|--------------------------------------------------------------------------
|
| Your application is not ready when this file is loaded by the framework.
| Hence, the top level imports relying on the IoC container will not work.
| You must import them inside the life-cycle methods defined inside
| the provider class.
|
| @example:
|
| public async ready () {
|   const Database = this.app.container.resolveBinding('Adonis/Lucid/Database')
|   const Event = this.app.container.resolveBinding('Adonis/Core/Event')
|   Event.on('db:query', Database.prettyPrint)
| }
|
*/
export default class IndexerProvider {
  // import Post Model inside class
  constructor(protected app: ApplicationContract) { }

  public register() {
    // Register your own bindings
  }

  public async boot() {
    // All bindings are ready, feel free to use them
  }

  public async ready() {
    const Transaction = (await require('App/models/Transaction')).default;
    const TransactionIndexer = (await require('App/lib/indexer/Indexer')).default;

    let transactions = await Transaction.query()
      .where('status', transactionStatus.TRANSACTION_CREATED)
      .where('type', transactionType.CRYPTO_OFFRAMP)

    for (const transaction of transactions) {
      new TransactionIndexer(transaction.uniqueId).__initializer()
    }

  }

  public async shutdown() {
    // Cleanup, since app is going down
  }
}
