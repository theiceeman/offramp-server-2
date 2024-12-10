// Ws.ts
import { Server } from 'socket.io'
import AdonisServer from '@ioc:Adonis/Core/Server'

class Ws {
  public io: Server
  private booted = false

  public boot() {
    /**
     * Ignore multiple calls to the boot method
     */
    console.log('ws open for connections...')
    if (this.booted) {
      return
    }

    this.booted = true
    global.io = new Server(AdonisServer.instance!, {
      cors: {
        origin: process.env.CLIENT_URL
      }
    })
  }
}

export default new Ws()

