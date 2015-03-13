/**
 * Run `node import.js` to import the sample data into the db.
 */

var async = require('async');

// sample data
var member = require('./member.json');
var tally = require('./tally.json');
var participation = require('./participation.json');
var detail = require('./detail.json');

module.exports = function(app, cb) {
  var Member = app.models.Member;
  var Tally = app.models.Tally;
  var Participation = app.models.Participation;
  var Detail = app.models.Detail;
  // var Car = app.models.Car;
  var db = app.dataSources.db;

  // var ids = {
  // };

  function importData(Model, data, cb) {
    // console.log('Importing data for ' + Model.modelName);
    Model.destroyAll(function(err) {
      if (err) {
        cb(err);
        return;
      }
      async.each(data, function(d, callback) {
        // if (ids[Model.modelName] === undefined) {
        //   // The Oracle data has Location with ids over 80
        //   // and the index.html depends on location 88 being present
        //   ids[Model.modelName] = 80;
        // }
        // d.id = ids[Model.modelName]++;
        Model.create(d, callback);
      }, cb);
    });
  }

  async.series([
    function(cb) {
      db.autoupdate(cb);
    },

    importData.bind(null, Participation, participation),
    importData.bind(null, Tally, tally),
    importData.bind(null, Member, member),
    importData.bind(null, Detail, detail)
  ], function(err/*, results*/) {
    cb(err);
  });
};

if (require.main === module) {
  // Run the import (server runs it automatically during boot)
  var app = require('../server');
  app.on('import done', function(err) {
    process.exit(err ? 1 : 0);
  });
}
