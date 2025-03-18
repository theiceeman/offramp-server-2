import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Bank from 'App/models/Bank'
import { v4 as uuid } from 'uuid'
import Env from '@ioc:Adonis/Core/Env'
import axios from 'axios'

export default class BankSeeder extends BaseSeeder {
  public async run() {
    try {
      // Get Paystack secret key from environment variables
      const paystackSecretKey = Env.get('PAYSTACK_SECRET_KEY')

      if (!paystackSecretKey) {
        throw new Error('PAYSTACK_SECRET_KEY environment variable is not defined')
      }

      // Fetch banks from Paystack API
      const response = await axios.get('https://api.paystack.co/bank', {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        }
      })

      // Check if request was successful
      if (!response.data.status) {
        throw new Error('Failed to fetch banks from Paystack API')
      }

      const banks = response.data.data

      // Create an array of bank objects to insert
      const bankData = banks.map((bank) => ({
        unique_id: uuid(),
        bank_name: bank.name,
        paystack_code: bank.code
      }))

      // Insert banks in batches to avoid potential issues with large datasets
      const batchSize = 100
      for (let i = 0; i < bankData.length; i += batchSize) {
        const batch = bankData.slice(i, i + batchSize)
        await Bank.createMany(batch)
      }

      console.log(`Successfully seeded ${bankData.length} banks`)
    } catch (error) {
      console.error('Error seeding banks:', error.message)
      throw error
    }
  }
}
