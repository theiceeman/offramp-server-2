// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class RolesController {

  public allowOnlySuperAdmins(auth) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')
    } catch (error) {
      throw new Error(error)
    }
  }

  public allowOnlyLoggedInUsers(auth) {
    try {
      const uniqueId = auth.use('user').user?.uniqueId ?? '';
      if (!uniqueId)
        throw new Error('Authentication error!')

      return uniqueId;
    } catch (error) {
      throw new Error(error)
    }
  }

}
