var multilevel   = require('multilevel');
var http         = require('http');
var shoe         = require('shoe');
var levelup      = require('levelup');
var leveldown    = require('leveldown');
var rimraf       = require('rimraf');
var airplanedb   = require('./');

var server = http.createServer();
server.listen(parseInt(process.env.PORT));

rimraf('airplanedb', function() {
  var db = levelup('airplanedb', {valueEncoding: 'json', db: leveldown});
  db = airplanedb(db);

  var sock = shoe(function (stream) {
    stream.pipe(multilevel.server(db)).pipe(stream);
  });

  sock.install(server, '/airplanedb');
});
