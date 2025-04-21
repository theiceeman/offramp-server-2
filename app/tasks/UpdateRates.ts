import CurrencyController from 'App/controllers/http/CurrencyController'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'

export default class UpdateRates extends BaseTask {
  public static get schedule() {

    // return CronTimeV2.everyHour()
    return CronTimeV2.everySecond()
  }
  /**
   * Set enable use .lock file for block run retry task
   * Lock file save to `build/tmp/adonis5-scheduler/locks/your-class-name`
   */
  public static get useLock() {
    return false
  }

  public async handle() {
    this.logger.info('Handled rates..')

    await new CurrencyController().updateNgnUsdRate()
  }
}
