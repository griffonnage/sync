import http from 'http'
import express from 'express'
import socketIO, { Client } from 'socket.io'
import redisAdapter from 'socket.io-redis'
import { StatsD } from 'node-statsd'
import pino from 'pino'
import pinoHttp from 'pino-http'

require('dotenv').config()

enum Events {
  userJoin = 'user-join',
  userLeave = 'user-leave',
  userList = 'user-list',
  newRoomData = 'new-room-data',
}

enum Metrics {
  usersCount = 'users_count',
  usersActive = 'users_active',
  roomsCount = 'rooms_count',
  roomsActive = 'rooms_active',
  roomsSize = 'rooms_size',
  roomsJoinCount = 'rooms_join_count',
  roomsLeaveCount = 'rooms_leave_count',
  roomsBroadcastDataCount = 'rooms_broadcast_data_count',
  roomsBroadcastDataLength = 'rooms_broadcast_data_length',
  roomsBroadcastVolatileDataCount = 'rooms_broadcast_volatile_data_count',
  roomsBroadcastVolatileDataLength = 'rooms_broadcast_volatile_data_length',
  errorsCount = 'errors_count',
}

const port = process.env.PORT || 80
const redisUri = process.env.REDIS_URI || undefined
const statsdHost = process.env.STATSD_HOST || undefined
const statsdPort = process.env.STATSD_PORT
  ? parseInt(process.env.STATSD_PORT)
  : 8125

const logger = pino()

const stats = new StatsD(statsdHost, statsdPort)

const app = express()
app.use((req, res, next) => {
  if (req.header('X-CleverCloud-Monitoring') === 'telegraf') {
    return res.sendStatus(200)
  }
  next()
})
app.use(pinoHttp())

const server = http.createServer(app)
server.listen(port, () => {
  logger.info(`Server started on port ${port}`)
})

const io = socketIO(server)
if (redisUri) {
  logger.info('Enabling Socket-IO Redis adapter')
  io.adapter(redisAdapter(redisUri))
}

io.on('connection', (socket) => {
  stats.increment(Metrics.usersCount)

  io.sockets.clients((err: Error | undefined, clients: Client[]) => {
    if (!err) {
      stats.gauge(Metrics.usersActive, clients.length)
    }
  })

  socket.on('error', () => {
    stats.increment(Metrics.errorsCount)
  })

  socket.on('disconnect', () => {
    io.sockets.clients((err: Error | undefined, clients: Client[]) => {
      if (!err) {
        stats.gauge(Metrics.usersActive, clients.length)
      }
    })
  })

  socket.on('join-room', (room) => {
    if (!(room in io.sockets.adapter.rooms)) {
      stats.increment(Metrics.roomsCount)
    }

    socket.join(room)
    socket.broadcast.to(room).emit(Events.userJoin, socket.id)
    const sids = Object.keys(io.sockets.adapter.rooms[room].sockets)
    io.in(room).emit(Events.userList, sids)

    stats.increment(Metrics.roomsJoinCount)
    stats.gauge(Metrics.roomsSize, sids.length)
  })

  socket.on('leave-room', (room) => {
    socket.leave(room)
    socket.broadcast.to(room).emit(Events.userLeave, socket.id)

    const rooms = io.sockets.adapter.rooms
    if (room in rooms) {
      const sids = Object.keys(rooms[room].sockets)
      socket.broadcast.to(room).emit(Events.userList, sids)

      stats.gauge(Metrics.roomsSize, sids.length)
    } else {
      stats.gauge(Metrics.roomsSize, 0)
    }

    stats.increment(Metrics.roomsLeaveCount)
  })

  socket.on('broadcast-room-data', (room: string, encryptedData: string) => {
    socket.broadcast.to(room).emit(Events.newRoomData, encryptedData)

    stats.increment(Metrics.roomsBroadcastDataCount)
    stats.gauge(Metrics.roomsBroadcastDataLength, encryptedData.length)
  })

  socket.on(
    'broadcast-volatile-room-data',
    (room: string, encryptedData: string) => {
      socket.volatile.broadcast.to(room).emit(Events.newRoomData, encryptedData)

      stats.increment(Metrics.roomsBroadcastVolatileDataCount)
      stats.gauge(
        Metrics.roomsBroadcastVolatileDataLength,
        encryptedData.length
      )
    }
  )
})
