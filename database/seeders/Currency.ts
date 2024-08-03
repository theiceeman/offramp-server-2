import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Currency from 'App/models/Currency'

export default class extends BaseSeeder {
  public async run() {
    await Currency.create(
      {
        "type": "fiat",
        "network": "fiat",
        "name": "Nigerian Naira",
        "symbol": "NGN",
        "logo": `${process.env.CLIENT_URL}/icons/ngn-logo.svg`,
        "tokenAddress": ""
      }
    )
  }
}
