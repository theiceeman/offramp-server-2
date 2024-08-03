import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Admin from 'App/models/Admin'

export default class extends BaseSeeder {
  public async run() {
    await Admin.create(
      {
        "type":"SUPER_ADMIN",
        "email":"admin@gmail.com",
        "password":"123456789"
    }
    )
  }
}
