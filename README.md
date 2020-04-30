# Griffonnage - Sync Server

> Scribble careless drawings with friends, privately

[![GitHub Tag](https://img.shields.io/github/tag/griffonnage/griffonnage-sync.svg)](https://github.com/griffonnage/griffonnage-sync/releases/latest)
[![GitHub Action CI/CD](https://github.com/griffonnage/griffonnage-sync/workflows/CI/CD/badge.svg)](https://github.com/griffonnage/griffonnage-sync/actions?query=workflow%3A%22CI%2FCD%22)
[![License](https://img.shields.io/github/license/griffonnage/griffonnage-sync)](https://github.com/griffonnage/griffonnage-sync/blob/master/LICENSE)

Synchronize drawings from Griffonnage using [Socket-io](https://socket.io).

## Build Setup

```
// install dependencies and post-build app
$ npm install

// run in development mode
$ npm run dev

// run in production mode
$ npm start
```

## Scaling

Some technical requirements are involved if you plan on deploying this
synchronization server as a cluster of nodes.

Please referer to the [Socket-IO Documentation]((https://socket.io/docs/using-multiple-nodes/))
on the matter for extensive explanations.

### Sticky sessions

Due to some long-polling operations required by Socket-IO,
you need a "sticky session" mechanism in your load-balancing system.

For instance, if using Heroku you must enable their
[Session Affinity](https://devcenter.heroku.com/articles/session-affinity) feature
for your app:

```
$ heroku features:enable http-session-affinity -a <app-id>
$ heroku features -a <app-id>
```

### Message broker

When scaling Socker-IO to multiple nodes, a message broker is required in order
to pass messages between nodes seamlessly. Fortunately, Socker-IO as an "adapter"
mechanism and an official [Redis Adapter](https://github.com/socketio/socket.io-redis).

The Redis adapter is already integrated into this app, but disabled by default.
To enable it, simply set the `REDIS_URI` environment variable:

```
REDIS_URI=redis://localhost:6379/0
```

## License

Licensed under GNU Affero General Public License v3.0 (AGPLv3)

Copyright (c) 2020 - present Romain Clement
