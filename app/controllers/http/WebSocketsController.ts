// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

import Ws from "App/lib/socket-io/Ws";
import SocketConnection from "App/models/SocketConnection";
import Transaction from "App/models/Transaction";

export default class WebSocketsController {

  // registerNewConnection - txnId, socketId
  // emitStatusUpdateToClient - txnId
  // closeConnection - txnId

  public async registerNewConnection(txnId: string, socketId: string) {
    try {
      let transaction = await SocketConnection.query()
        .where('transaction_id', txnId)
      // console.log({transaction})
      if (transaction.length > 0) return;

      let result = await SocketConnection.create({
        socketConnectionId: socketId,
        transactionId: txnId,
      });

      if (result == null) throw new Error("Action failed!")

    } catch (error) {
      throw new Error(error.message)
    }
  }

  public async emitStatusUpdateToClient(txnId: string) {
    try {
      let connection = await SocketConnection
        .query().where('transaction_id', txnId)
        if(connection.length < 1)return;

      let transaction = await Transaction.query()
        .where('unique_id', txnId)

      if (connection) {
        console.log('emitted to,', connection[0].socketConnectionId)

        Ws.io.to(connection[0].socketConnectionId)
          .emit('transaction_status',
            { status: transaction[0].status, txnId })


      }

    } catch (error) {
      throw new Error(error.message)
    }
  }


  public async closeConnection(connectionId: string) {
    try {
      console.log('close connection,', connectionId)

      await SocketConnection.query()
        .where('socket_connection_id', connectionId)
        .delete()

      // if (result == null) throw new Error("Action failed!")

    } catch (error) {
      throw new Error(error.message)
    }
  }


}
