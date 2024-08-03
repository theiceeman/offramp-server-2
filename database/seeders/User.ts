import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import User from 'App/models/User'

export default class extends BaseSeeder {
  public async run() {
    await User.create(
      {
        "email":"tester1@gmail.com",
        "password":"123456789"
    }
    )
  }
}
