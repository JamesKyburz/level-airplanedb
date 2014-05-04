if (!window.indexedDB) {
  require('IndexedDBShim/dist/IndexedDBShim.js');
}

var sublevel  = require('level-sublevel');
var map  = require('map-stream');
var stringify = require('json-stable-stringify');

module.exports = airportdb;

function airportdb(db) {
  if (db.sync) return db;
  db = sublevel(db);

  var changelog = db.sublevel('changelog');
  var lastSync  = db.sublevel('lastsync');

  var excludeChange = {};

  db.pre(addChange);

  function addChange(ch, add) {
    if (excludeChange[ch.key]) return;
    add({
      key: ch.key,
      value: {
        value: ch.value,
        type: ch.type
      },
      type: 'put',
      prefix: changelog
    });
  };

  db.sync = sync;

  return db;

  function sync(range, remotedb, cb) {
    var stringRange = stringify(range);
    changelog.createReadStream(range)
    .pipe(map(replicateTo))
    .on('error', error)
    .on('end', syncFrom)
    ;

    function error(err) {
      excludeChange = {};
      cb(err);
    }

    function replicateTo(item, cb) {
      if (item.value.type === 'del') {
        remotedb.del(item.key, done);
      } else {
        remotedb.put(item.key, item.value.value, done);
      }
      function done(err) {
        if (err) return cb(err);
        changelog.del(item.key, cb);
      }
    }

    function syncFrom() {
      lastSync.get(stringRange, function ts(err, from) {
        remotedb.sync(from, range).pipe(map(replicateFrom))
        .on('error', error)
        .on('end', cb)
        ;
      });

      function replicateFrom(item, cb) {
        var ts = item.key.slice(-28, -4);
        var method = item.key.slice(-3);
        var key = item.key.slice(0, -29);
        excludeChange[key] = true;
        if ('del' === method) {
          db.del(key, done);
        } else {
          db.put(key, item.value, done);
        }
        function done(err) {
          delete excludeChange[key];
          if (err) return cb(err);
          lastSync.put(stringRange, ts, cb);
        }
      }
    }
  }
}
