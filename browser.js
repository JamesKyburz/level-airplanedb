require('IndexedDBShim/dist/IndexedDBShim.js');

var sublevel  = require('level-sublevel');
var map  = require('map-stream');
var stringify = require('json-stable-stringify');

module.exports = airplanedb;

function airplanedb(db) {
  if (db.sync) return db;

  db = sublevel(db);

  var changelog = db.sublevel('changelog');
  var lastSync  = db.sublevel('lastsync');
  var replicating = {};

  var hook;

  function addHook() {
    if (!hook) hook = db.pre(addChange);
  }

  function removeHook() {
    if (hook) hook();
    hook = null;
  }

  function running() {
    return !!hook;
  }

  addHook();

  function addChange(ch, add, batch) {
    if (ch.key in replicating) {
      var value = replicating[ch.key];
      delete replicating[ch.key];
      if (stringify(ch.value) === stringify(value)) return;
    }
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
  db.sync.on = addHook;
  db.sync.running = running;
  db.sync.off = removeHook;

  return db;

  function sync(range, remotedb, cb) {
    var stringRange = stringify(range);
    changelog.createReadStream(range)
    .pipe(map(replicateTo))
    .on('error', cb)
    .on('end', syncFrom)
    ;

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
      lastSync.get(stringRange, function ts(err, from) {
        remotedb.sync(from, range).pipe(map(replicateFrom))
        .on('error', cb)
        .on('end', cb)
        ;
      });

      var maxTs = '';

      function replicateFrom(item, cb) {
        var ts = item.key.slice(-28, -4);
        var method = item.key.slice(-3);
        var key = item.key.slice(0, -29);
        if ('del' === method) {
          replicating[key] = undefined;
          db.del(key, done);
        } else {
          replicating[key] = item.value;
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
