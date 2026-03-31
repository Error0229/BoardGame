import { io, Socket } from 'socket.io-client'
import type { ClientToServer, ServerToClient } from '@kindred/shared'

const socket: Socket<ServerToClient, ClientToServer> = io({
  autoConnect: true,
})

export default socket
