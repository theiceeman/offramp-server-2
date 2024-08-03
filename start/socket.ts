// socket.ts
import WebSocketsController from 'App/controllers/http/WebSocketsController'
import { genRandomUuid } from 'App/helpers/utils'
import Ws from 'App/lib/socket-io/Ws'
import { Socket } from 'socket.io'
Ws.boot()

/**
 * Listen for incoming socket connections
 */
Ws.io.on('connection', (socket: Socket) => {
  console.log('ws client connected.')
  let _txnId: Array<string> = []

  socket.on('register_connection', async ({ txnId }: { txnId: string }) => {
    if (_txnId.length > 0) return;

    _txnId.push(txnId)
    const socketId = txnId + ':' + genRandomUuid();
    socket.join(socketId)

    await new WebSocketsController()
      .registerNewConnection(txnId, socketId)

    // Ws.io.to(socketId).emit("transaction_status", { status: 'seen', txnId });
    console.log('connection registered', socketId)
  })


  socket.on('close_connection', async () => {
    console.log('ws client disconnected.')

    await new WebSocketsController()
      .closeConnection(_txnId[0])
  })



  socket.on('my other event', (data) => {
    console.log(data)
  })
})

