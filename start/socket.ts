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
  let connections: Array<string> = []
  const socketId = genRandomUuid();

  socket.on('register_connection', async ({ txnId }: { txnId: string }) => {
    if (connections.length > 0) return;

    await new WebSocketsController()
      .registerNewConnection(txnId, socketId)

    socket.join(socketId)
    connections.push(socketId)
    console.log({ connections })

    // Ws.io.to(socketId).emit("transaction_status", { status: 'seen', txnId });
    console.log('connection registered', socketId)
  })


  socket.on('close_connection', async () => {
    console.log('ws connection closed.', socketId)

    if (connections.length < 1) return;
    await new WebSocketsController()
      .closeConnection(connections[0])

  })

  // socket.on('disconnect', async () => {
  //   console.log('ws client disconnected.', socket.id);

  //   if (connections.length < 1) return;
  //   await new WebSocketsController()
  //     .closeConnection(connections[0]);

  // });



  socket.on('my other event', (data) => {
    console.log(data)
  })
})

