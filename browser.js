if (!window.indexedDB) {
  require('IndexedDBShim/dist/IndexedDBShim.js');
}

var sublevel  = require('level-sublevel');
var map  = require('map-stream');
var stringify = require('json-stable-stringify');

module.exports = airportdb;

function airportdb(db) {
  if (db.sync) return db;
  var removeHook;

  db = sublevel(db);

  var changelog = db.sublevel('changelog');
  var lastSync  = db.sublevel('lastsync');

  function addHook() {
    if (!removeHook) removeHook = db.pre(addChange);
  }

  function addChange(ch, add) {
    add({
      key: ch.key,
      value: {
        type: ch.type
      },
      type: 'put',
      prefix: changelog
    });
  };

  db.sync = sync;
  sync.on = addHook;
  sync.off = function off() {
    if (removeHook) removeHook();
    removeHook = false;
  }

  return db;

  function sync(range, remotedb, cb) {
    var stringRange = stringify(range);
    changelog.createReadStream(range)
    .pipe(map(replicateTo))
    .on('error', error)
    .on('end', syncFrom)
    ;

    function error(err) {
      sync.on();
      cb(err);
    }

    function replicateTo(item, cb) {
      if (item.value.type === 'del') {
        remotedb.del(item.key, done);
      } else {
        db.get(item.key, function(err, value) {
          if (err) return done(err);
          remotedb.put(item.key, value, done);
        });
      }
      function done(err) {
        if (err) return cb(err);
        changelog.del(item.key, cb);
      }
    }

    function syncFrom() {
      sync.off();
      lastSync.get(stringRange, function ts(err, from) {
        remotedb.sync(from, range).pipe(map(replicateFrom))
        .on('error', error)
        .on('end', complete)
        ;
      });

      var maxTs = '';

      function complete() {
        sync.on();
        cb();
      }

      function replicateFrom(item, cb) {
        var ts = item.key.slice(-28, -4);
        var method = item.key.slice(-3);
        var key = item.key.slice(0, -29);
        if ('del' === method) {
          db.del(key, done);
        } else {
          db.put(key, item.value, done);
        }
        function done(err) {
          if (err) return cb(err);
          if (ts > maxTs) {
            lastSync.put(stringRange, ts.slice(0, -1) + '\xff', cb);
            maxTs = ts;
          } else {
            cb();
          }
        }
      }
    }
  }
}
