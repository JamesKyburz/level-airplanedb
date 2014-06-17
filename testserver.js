var multilevel = require('multilevel');
var http       = require('http');
var Engine     = require('engine.io-stream');
var levelup    = require('levelup');
var leveldown  = require('leveldown');
var rimraf     = require('rimraf');
var airplanedb = require('./');

var server = http.createServer();
server.listen(process.env.PORT);

rimraf('airplanedb', function() {
  var db = levelup('airplanedb', {valueEncoding: 'json', db: leveldown});
  db = airplanedb(db);

  var engine = Engine(function (stream) {
    stream.pipe(multilevel.server(db)).pipe(stream);
  });

  engine.attach(server, '/airplanedb');
});
