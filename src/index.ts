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
    socket.broadcast.to(room).emit('new-user', socket.id)
  })

  socket.on('send-canvas-state', (room: string, canvasState: string) => {
    socket.broadcast.to(room).emit('new-canvas-state', canvasState)
  })
})
