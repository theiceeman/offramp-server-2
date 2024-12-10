// socket.ts
import WebSocketsController from 'App/controllers/http/WebSocketsController'
import { genRandomUuid } from 'App/helpers/utils'
import Ws from 'App/lib/socket-io/Ws'
import { Socket } from 'socket.io'
Ws.boot()

/**
 * Listen for incoming socket connections
 */
global.io.on('connection', (socket: Socket) => {
  console.error('ws client connected.')
  let connections: Array<string> = []
  const socketId = genRandomUuid();

  socket.on('register_connection', async ({ txnId }: { txnId: string }) => {
    if (connections.length > 0) return;

    await new WebSocketsController()
      .registerNewConnection(txnId, socketId)

    socket.join(socketId)
    connections.push(socketId)
    console.error({ connections })

    // Ws.io.to(socketId).emit("transaction_status", { status: 'seen', txnId });
    console.info('connection registered', socketId)
  })


  socket.on('close_connection', async () => {
    console.info('ws connection closed.', socketId)

    if (connections.length < 1) return;
    await new WebSocketsController()
      .closeConnection(connections[0])

  })

  // socket.on('disconnect', async () => {
  //   console.error('ws client disconnected.', socket.id);

  //   if (connections.length < 1) return;
  //   await new WebSocketsController()
  //     .closeConnection(connections[0]);

  // });



  socket.on('my other event', (data) => {
    console.error(data)
  })
})

