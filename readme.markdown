# level-airplanedb

This module allows you to work offline in the browser using indexdb (+ shim for websql when indexdb not available).

You get a sync method in browserified client to write to the server.
The server gets a sync method that returns a readstream of the changelog
after the given timestamp.

[![js-standard-style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://github.com/feross/standard)
[![build status](https://api.travis-ci.org/JamesKyburz/level-airplanedb.svg)](https://travis-ci.org/JamesKyburz/level-airplanedb)
[![npm](https://img.shields.io/npm/v/level-airplanedb.svg)](https://npmjs.org/package/level-airplanedb)
[![downloads](https://img.shields.io/npm/dm/level-airplanedb.svg)](https://npmjs.org/package/level-airplanedb)
[![Sauce Test Status](https://saucelabs.com/browser-matrix/level-airplanedb.svg)](https://saucelabs.com/u/level-airplanedb)

# Example client

``` js
const levelup = require('levelup')
const leveljs = require('level-js')
const airplanedb = require('level-airplanedb')

const db = airplanedb(levelup('test', {db: leveljs}))

// sync range
// any keys in local changelog will be written to the server
// any keys from remotedb will be synced to client
db.sync({start: ..., end: ...}, remotedb, cb)

// changes to local db will be written to changelog removed when synced.
```

# Example server

``` js
const levelup = require('levelup')
const leveldown = require('leveldown')
const airplanedb = require('level-airplanedb')

const db = airplanedb(levelup('test', {db: leveldown}))

db.sync(from, range) // readstream of changelog >= from
```

# Background

In the spirit of offline first I wanted a working offline storage,
giving me the choice when to sync saving battery usage.

[level-sublevel](https://github.com/dominictarr/level-sublevel) is used to
persist the changelog both on client and server.

See [test/simple.js](https://github.com/JamesKyburz/level-airplanedb/blob/master/test/simple.js) for a client server example using :-

[multilevel](https://github.com/juliangruber/multilevel) - leveldb over
network

[level-js](https://github.com/maxogden/level.js) - leveldown api in the
browser

# Gotchas

This is a work in progress, conflicts are not handled at all!
The client's changelog is what is written to the server.

Updating keys in the same range as a running sync is not supported,
doing this will incur loss of data.

# install

With [npm](https://npmjs.org) do:

```
npm install level-airplanedb
```

# test

```
npm test
```

# license

MIT
