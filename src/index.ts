import http from 'http'
import express from 'express'
import socketIO from 'socket.io'
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

  io.sockets.clients((err: Error | undefined, clients: string[]) => {
    if (!err) {
      stats.gauge(Metrics.usersActive, clients.length)
    }
  })

  socket.on('error', () => {
    stats.increment(Metrics.errorsCount)
  })

  socket.on('disconnect', () => {
    io.sockets.clients((err: Error | undefined, clients: string[]) => {
      if (!err) {
        stats.gauge(Metrics.usersActive, clients.length)
      }
    })
  })

  socket.on('join-room', (room) => {
    if (!(room in io.sockets.adapter.rooms)) {
      // NOTE: this will not work properly with redis-adapter
      // ideally, should call io.sockets.adapter.allRooms()
      // https://github.com/socketio/socket.io-redis#redisadapterallroomsfnfunction
      stats.increment(Metrics.roomsCount)
    }

    socket.join(room)
    socket.to(room).emit(Events.userJoin, socket.id)

    io.in(room).clients((err: Error | undefined, clients: string[]) => {
      if (!err) {
        io.in(room).emit(Events.userList, clients)

        stats.gauge(Metrics.roomsSize, clients.length)
      }
    })

    stats.increment(Metrics.roomsJoinCount)
  })

  socket.on('leave-room', (room) => {
    socket.leave(room)
    socket.to(room).emit(Events.userLeave, socket.id)

    io.in(room).clients((err: Error | undefined, clients: string[]) => {
      if (!err) {
        io.in(room).emit(Events.userList, clients)

        stats.gauge(Metrics.roomsSize, clients.length)
      }
    })

    stats.increment(Metrics.roomsLeaveCount)
  })

  socket.on('broadcast-room-data', (room: string, encryptedData: string) => {
    socket.to(room).emit(Events.newRoomData, encryptedData)

    stats.increment(Metrics.roomsBroadcastDataCount)
    stats.gauge(Metrics.roomsBroadcastDataLength, encryptedData.length)
  })

  socket.on(
    'broadcast-volatile-room-data',
    (room: string, encryptedData: string) => {
      socket.volatile.to(room).emit(Events.newRoomData, encryptedData)

      stats.increment(Metrics.roomsBroadcastVolatileDataCount)
      stats.gauge(
        Metrics.roomsBroadcastVolatileDataLength,
        encryptedData.length
      )
    }
  )
})
