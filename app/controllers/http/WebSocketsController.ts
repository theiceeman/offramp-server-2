import SocketConnection from "App/models/SocketConnection";
import Transaction from "App/models/Transaction";
import { IPCMessage, PROCESS_TYPES } from "App/helpers/types";

export default class WebSocketsController {

  public async registerNewConnection(txnId: string, socketId: string) {
    try {
      let transaction = await SocketConnection.query()
        .where('transaction_id', txnId)
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
      if (connection.length < 1) return;

      let transaction = await Transaction.query()
        .where('unique_id', txnId)

      // In indexer process - send message to parent
      if (process.env.PROCESS_TYPE === PROCESS_TYPES.INDEXER) {
        const message: IPCMessage = {
          type: 'socket_emit',
          data: {
            socketId: connection[0].socketConnectionId,
            status: transaction[0].status,
            txnId
          }
        };
        process.send?.(message);
      } else {
        if (global.io) {
          global.io.to(connection[0].socketConnectionId)
            .emit('transaction_status', {
              status: transaction[0].status,
              txnId
            });
        }
      }

    } catch (error) {
      throw new Error(error.message)
    }
  }


  public async closeConnection(connectionId: string) {
    try {
      console.log('closing connection,', connectionId)

      await SocketConnection.query()
        .where('socket_connection_id', connectionId)
        .delete()

      // if (result == null) throw new Error("Action failed!")

    } catch (error) {
      throw new Error(error.message)
    }
  }


}
