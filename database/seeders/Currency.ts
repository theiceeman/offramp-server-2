import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import { currencyNetwork } from 'App/helpers/types'
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
    await Currency.create(
      {
        "type": "crypto",
        "network": currencyNetwork.assetchain_testnet,
        "name": "USDT TETHER",
        "symbol": "USDT",
        "logo": `${process.env.CLIENT_URL}/icons/usdt-logo.svg`,
        "tokenAddress": "0x04f868C5b3F0A100a207c7e9312946cC2c48a7a3",
        "marketUsdRate":1
      }
    )
    await Currency.create(
      {
        "type": "crypto",
        "network": currencyNetwork.bsc,
        "name": "USDT TETHER",
        "symbol": "USDT",
        "logo": `${process.env.CLIENT_URL}/icons/usdt-logo.svg`,
        "tokenAddress": "0x55d398326f99059fF775485246999027B3197955",
        "marketUsdRate":1
      }
    )
  }
}
