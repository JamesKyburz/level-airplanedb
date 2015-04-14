// phantomjs it's 2014 and still no bind :(
Function.prototype.bind = require('function-bind');

var airplanedb = require('./..');
var levelup = require('levelup');
var leveljs = require('level-js');
var request = require('hyperquest');

var url = window.location.protocol + '//' + window.location.host + '/sequence';

var fixtures = require('bulk-require')(__dirname + '/fixtures', '*.json');
var engine = require('engine.io-stream');
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

var test = require('tape');
var db, name, remoteDb;

request(url, function(err, res) {
  if (err) return console.error(err);
  name = res.headers['x-dbname'];
  db = levelup(name, {db: leveljs, valueEncoding: 'json'});

  // safari sometimes bombs out with OpenError until that's fixed this on error helps
  db.once('error', function(err) {
    if (err && 'OpenError' === err.type) {
      return window.setTimeout(window.location.reload.bind(window.location), 700);
    } else {
      throw err;
    }
  });

  remoteDb = multilevel.client(manifest);

  var config = {
    transports: ['polling'],
    hostname: location.hostname,
    port: location.port,
    path: '/' + name
  };
  var stream = engine('/' + name);
  stream.pipe(remoteDb.createRpcStream()).pipe(stream);

  db = airplanedb(db);
  db.once('ready', ready);
});

function ready() {
  test('sync on', function(t) {
    t.plan(1);
    t.true(db.sync.running(), 'sync is running');
  });

  test('sync off', function(t) {
    t.plan(4);
    t.true(db.sync.running(), 'sync is running');
    db.sync.off();
    t.false(db.sync.running(), 'sync is not running');
    db.put('test', 42, function() {
      db.sublevels.changelog.get('test', function(err) {
        t.true(err.notFound, 'test not added to changelog');
        db.sync.on();
        t.true(db.sync.running(), 'sync is running');
      });
    });
  });

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
    leveljs.destroy(name, function() {});
    t.end();
  });
}
