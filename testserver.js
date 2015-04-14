var multilevel = require('multilevel');
var http       = require('http');
var engine     = require('engine.io-stream');
var levelup    = require('levelup');
var leveldown  = require('leveldown-prebuilt');
var rimraf     = require('rimraf');
var airplanedb = require('./');

var server = http.createServer();
server.listen(process.env.ZUUL_PORT);

var sequence = 1;

server.on('request', function(q, r) {
  if (q.url === '/sequence') {
    setup('airplanedb' + ++sequence, function(name) {
      r.setHeader('x-dbname', name);
      r.end();
    });
    return;
  }
});

function setup(name, cb) {
  rimraf(name, function() {
    var db = levelup(name, {valueEncoding: 'json', db: leveldown});
    db = airplanedb(db);

    var sock = engine(function (stream) {
      stream.pipe(multilevel.server(db)).pipe(stream);
    });

    sock.attach(server, '/' + name);
    cb(name);
  });
}

