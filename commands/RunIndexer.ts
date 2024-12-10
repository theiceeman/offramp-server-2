// commands/RunIndexer.ts
import { args, BaseCommand } from '@adonisjs/core/build/standalone';
import { PROCESS_TYPES } from 'App/helpers/types';
import BuyCryptoIndexer from 'App/lib/indexer/BuyCryptoIndexer';

export default class RunIndexer extends BaseCommand {
  public static commandName = 'run:indexer';
  public static description = 'Run the crypto indexer in a separate process';

  // Define argument for transaction ID
  public static settings = {
    loadApp: true  // Add this line
  }


  @args.string({ name: 'txnId', description: 'Transaction ID to index' })
  public txnId: string

  public async run() {

    if (!this.parsed) {
      console.error('Transaction ID is required.');
      process.exit(1);
    }
    console.log(this.txnId)

    try {
      process.env.PROCESS_TYPE = PROCESS_TYPES.INDEXER;

      await new BuyCryptoIndexer(this.txnId).__initializer();
      process.exit(0);
    } catch (error) {
      console.error('Indexer failed:', error);
      process.exit(1);
    }
  }
}
