import http from 'http'
import express from 'express'
import socketIO from 'socket.io'
import pino from 'pino'
import pinoHttp from 'pino-http'

require('dotenv').config()

const port = process.env.PORT || 80

const logger = pino()

const app = express()
app.use(pinoHttp())

const server = http.createServer(app)
server.listen(port, () => {
  logger.info(`Server started on port ${port}`)
})

const io = socketIO(server)

io.on('connection', (socket) => {
  socket.on('join-room', (room) => {
    socket.join(room)
    socket.broadcast.to(room).emit('user-join', socket.id)
  })

  socket.on('leave-room', (room) => {
    socket.leave(room)
    socket.broadcast.to(room).emit('user-leave', socket.id)
  })

  socket.on('broadcast-room-data', (room: string, encryptedData: string) => {
    socket.broadcast.to(room).emit('new-room-data', encryptedData)
  })

  socket.on(
    'broadcast-volatile-room-data',
    (room: string, encryptedData: string) => {
      socket.volatile.broadcast.to(room).emit('new-room-data', encryptedData)
    }
  )
})
