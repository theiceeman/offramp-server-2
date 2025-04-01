// socket.ts
import WebSocketsController from 'App/controllers/http/WebSocketsController'
import Ws from 'App/lib/socket-io/Ws'
import { Socket } from 'socket.io'
Ws.boot()

/**
 * Listen for incoming socket connections
 */
global.io.on('connection', (socket: Socket) => {
  console.error('ws client connected.')
  let connections: Array<string> = []

  socket.on('register_connection', async ({ txnId }: { txnId: string }) => {
    if (connections.length > 0) return;

    await new WebSocketsController()
      .registerNewConnection(txnId, txnId)

    socket.join(txnId)
    connections.push(txnId)
    console.error({ connections })

    console.info('connection registered', txnId)
  })


  socket.on('close_connection', async (txnId) => {
    console.info('ws connection closed.', txnId)

    if (connections.length < 1) return;
    await new WebSocketsController()
      .closeConnection(connections[0])

  })


  socket.on('my other event', (data) => {
    console.error(data)
  })
})

