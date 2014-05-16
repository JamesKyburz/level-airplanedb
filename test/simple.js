var airplanedb = require('./..');
var levelup = require('levelup');
var leveljs = require('level-js');
var fixtures = require('bulk-require')(__dirname + '/fixtures', '*.json');


require('tap-browser-color')();

var shoe = require('shoe');
var multilevel = require('multilevel');
var manifest = {
  "methods": {
    "sync": { "type": "readable" },
    "createReadStream": { "type": "readable" },
    "put": { "type": "async" },
    "get": { "type": "async" },
    "del": { "type": "async" }
  }
};

var db = levelup('airplanedb', {db: leveljs, valueEncoding: 'json'});

// safari sometimes bombs out with OpenError until that's fixed this on error helps
db.on('error', window.location.reload.bind(window.location));

db = airplanedb(db);
var remoteDb = multilevel.client(manifest);

var stream = shoe('/airplanedb');
stream.pipe(remoteDb.createRpcStream()).pipe(stream);

var test = require('tape');

Object.keys(fixtures).forEach(function(name) {
  test(name, function(t) {
    var fixture = fixtures[name];

    t.test(name + ' localsetup', function(t) {
      if (!fixture.localSetup.length) return t.end();
      db.batch(fixture.localSetup, function(err) {
        t.notOk(err, 'local batch written');
        t.end();
      });
    });

    t.test(name + ' changelog', function(t) {
      var items = [];
      db.sublevel('changelog').createReadStream(fixture.range)
      .on('data', function(item) {
        items.push(item);
      })
      .on('end', function() {
        t.deepEqual(items, fixture.assertChangelog, 'change log ok');
        t.end();
      });
    });

    t.test(name + ' remotesetup', function(t) {
      var batch = fixture.remoteSetup.slice();

      next();

      function next() {
        var op = batch.shift();
        if (op) {
          if ('put' === op.type) {
            remoteDb.put(op.key, op.value, done);
          } else {
            remoteDb.del(op.key, done);
          }
        } else {
          t.end();
        }
        function done(err) {
          t.notOk(err, 'remote op ok');
          next();
        }
      }
    });

    t.test(name + ' sync', function(t) {
      if (!fixture.sync) return t.end();
      db.sync(fixture.range, remoteDb, function(err) {
        t.notOk(err, 'sync ok');
        var items = [];
        db.sublevel('changelog').createReadStream(fixture.range)
        .on('data', function(item) {
          items.push(item);
        })
        .on('end', function() {
          t.deepEqual(items, [], 'change log empty');
          t.end();
        });
      });
    });

    t.test(name + ' localdb', function(t) {
      var items = [];
      db.createReadStream(fixture.range)
      .on('data', function(item) {
        items.push(item);
      })
      .on('end', function() {
        t.deepEqual(items, fixture.assertLocalDb, 'local db items ok');
        t.end();
      });
    });

    t.test(name + ' remotedb', function(t) {
      var items = [];
      remoteDb.createReadStream(fixture.range)
      .on('data', function(item) {
        items.push(item);
      })
      .on('end', function() {
        t.deepEqual(items, fixture.assertRemoteDb, 'remote db items ok');
        t.end();
      });
    });
  });
});

test('cleanup', function(t) {
  leveljs.destroy('airplanedb', function() {});
  t.end();
});
