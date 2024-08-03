import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { schema } from '@ioc:Adonis/Core/Validator'
import { formatErrorMessage } from 'App/helpers/utils';
import Ticket from 'App/models/Ticket';

export default class TicketsController {

  private async validate(request) {
    const transactionSchema = schema.create({
      title: schema.string({ trim: true }),
      message: schema.string({ trim: true }),
    })
    const messages = {
      required: 'The {{ field }} is required.'
    }
    await request.validate({ schema: transactionSchema, messages });
  }

  /**
   * For users to create a new ticket.
   * @param param0
   */
  public async createTicket({ request, response, auth }: HttpContextContract) {
    try {
      const data = request.body();
      await this.validate(request)

      let user = auth.use('user').user;
      if (!user?.uniqueId) throw new Error('Authentication error!')

      let result = await Ticket.create({
        userId: user.uniqueId,
        title: data.title,
        message: data.message,
        main: true,
      });

      if (result !== null) {
        response.status(200).json({ data: "Ticket created." });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * For admins & users to reply tickets.
   * @param param0
   */
  public async replyTicket({ request, response, auth, params }: HttpContextContract) {
    try {
      const data = request.body();
      const _schema = schema.create({
        message: schema.string({ trim: true }),
      })
      const messages = {
        required: 'The {{ field }} is required.'
      }
      await request.validate({ schema: _schema, messages });

      let user = auth.use('user')?.user
      let admin = auth.use('admin')?.user;

      // let user = auth.use('user')?.user ?? auth.use('admin')?.user;
      if (!user?.uniqueId && !admin?.uniqueId) throw new Error('Authentication error!')

      let transaction = await Ticket.query().where('unique_id', params.ticketId)
      if (transaction.length < 1) throw new Error('Ticket doesn\'t exist!')


      let result = await Ticket.create({
        userId: user?.uniqueId ?? null,
        adminId: admin?.uniqueId ?? null,
        mainId: params.ticketId,
        title: data.title,
        message: data.message,
        main: false,
      });

      if (result !== null) {
        response.status(200).json({ data: "Ticket replied." });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * For admins & users to view all conversation under a ticket.
   * @param param0
   */
  public async viewConversation({ response, auth, params }: HttpContextContract) {
    try {
      let user = auth.use('user')?.user ?? auth.use('admin')?.user;
      if (!user?.uniqueId) throw new Error('Authentication error!')

      // make sure another user cant pull conversation of another user.
      if (auth.use('admin')?.user?.type) {
        let transaction = await Ticket.query().where('unique_id', params.ticketId)
        if (transaction.length < 1) throw new Error('Ticket doesn\'t exist!')

      } else {
        let transaction = await Ticket.query()
          .where('unique_id', params.ticketId)
          .where('user_id', user.uniqueId)
        if (transaction.length < 1) throw new Error('Ticket doesn\'t exist!')
      }

      let data = await Ticket.query()
        .preload('user', (query) => query.select('email'))
        .where('main_id', params.ticketId)
        .where('is_deleted', false)
        .orderBy('id', 'asc')

      response.status(200).json({ data });

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * For users logged in to view their tickets.
   * @param param0
   */
  public async viewUserTickets({ request, response, auth }: HttpContextContract) {
    try {
      await this.validate(request)

      let user = auth.use('user').user;
      if (!user?.uniqueId) throw new Error('Authentication error!')

      let data = await Ticket.query()
        .where('user_id', user.id)
        .where('main', true)
        .where('is_deleted', false)

      response.status(200).json({ data });

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }

  /**
   * For admin to view all tickets created by users.
   * @param param0
   */
  public async viewTickets({ request, response, auth }: HttpContextContract) {
    try {

      let user = auth.use('admin').user;
      if (!user?.uniqueId) throw new Error('Authentication error!')

      const { status } = request.qs()

      let data = await Ticket.query()
        .preload('admin', (query) => query.select('email'))
        .preload('user', (query) => query.select('email'))
        .if(status, query => query.where({ status }))
        .where('main', true)

      response.status(200).json({ data });

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }



  public async closeTicket({ params, response, auth }: HttpContextContract) {
    try {
      let user = auth.use('admin').user;
      if (!user?.uniqueId) throw new Error('Authentication error!')

      let ticket = await Ticket.query().where('unique_id', params.ticketId)
      if (ticket[0].status === 'closed') throw new Error('Ticket already closed.')

      let result = await Ticket.query()
        .where('main_id', params.ticketId)
        .update({ status: 'closed' })

      if (result[0] > 0) {
        response.status(200).json({ data: "Ticket Closed." });
      } else {
        throw new Error("Action failed!");
      }

    } catch (error) {
      response.status(400).json(await formatErrorMessage(error))
    }
  }


}
