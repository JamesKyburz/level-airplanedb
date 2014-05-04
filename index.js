var sublevel = require('level-sublevel');
var monot = require('monot');
var map = require('map-stream');
var deleteRange = require('level-delete-range');

var Timestamp = monot();

module.exports = airportdb;

function airportdb(db) {
  db = sublevel(db);
  if (db.sync) return db;
  var changelog = db.sublevel('changelog');

  db.pre(addChange);

  function addChange(ch, add) {
    add({
      key: ch.key + '!' + new Timestamp().toISOString() + '!' + ch.type,
      value: ch.value || '',
      type: 'put',
      prefix: changelog
    });
  }

  changelog.post(cleanup);

  function cleanup(ch) {
    if ('del' === ch.type) return;
    deleteRange(changelog, {
      start: ch.key.slice(0, -28),
      end: ch.key.slice(0, -28)
    });
  }

  db.sync = sync;

  function sync(from, range) {
    from = from || '0000-00-00T00:00:00.000Z';
    return changelog.createReadStream(range)
    .pipe(map(filter))
    ;

    function filter(item, cb) {
      var ts = item.key.slice(-28, -4);
      if (ts >= from) return cb(null, item);
      cb();
    }
  }

  return db;
}
