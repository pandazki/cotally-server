var loopback = require('loopback');
var Q = require('q');

module.exports = function(Tally) {

  Tally.remoteMethod(
    'createTally', {
      description: 'Create new tally.',
      accepts: [{
        arg: 'tallyName',
        type: 'string'
      }, {
        arg: 'tallyDesc',
        type: 'string'
      }],
      returns: {
        arg: 'tallyId',
        type: 'number'
      }
    }
  );
  Tally.createTally = function(tallyName, tallyDesc, cb) {
    var ctx = loopback.getCurrentContext();
    var currentUser = ctx && ctx.get('currentUser');

    //check user
    if (!currentUser) {
      cb(new Error('No user with this access token was found.'))
    }
    console.log('currentUser.email: ', currentUser.email);

    //create tally and participation set current user to admin
    //todo : check exist and ensure transaction

    Tally.create({
      "name": tallyName,
      "desc": tallyDesc
    }).then(function(tally) {
      console.log(tally);
      return Tally.app.models.Participation.create({
        "memberId": currentUser.id,
        "tallyId": tally.id,
        "isAdmin": true
      });
    }).then(function(participation) {
      console.log(participation);
      cb(null, participation.tallyId);
    });
  };

  Tally.remoteMethod(
    'joinTally', {
      description: 'Join into a tally.',
      accepts: {
        arg: 'tallyId',
        type: 'number',
        required: true
      },
      returns: {
        arg: 'participationId',
        type: 'number'
      },
      http: {
        verb: 'post',
        path: '/:tallyId/join'
      }
    }
  );
  Tally.joinTally = function(tallyId, cb) {
    //todo: check args
    var ctx = loopback.getCurrentContext();
    var currentUser = ctx && ctx.get('currentUser');
    //check user
    if (!currentUser) {
      cb(new Error('No user with this access token was found.'))
    }
    console.log('currentUser.email: ', currentUser.email);

    Tally.app.models.Participation.find({
      where: {
        tallyId: tallyId,
        memberId: currentUser.id
      }
    }, {})
      .then(function (participations) {
        if(participations && participations.length == 1)
          return participations[0];
        return Tally.app.models.Participation.create({
          "memberId": currentUser.id,
          "tallyId": tallyId,
          "isAdmin": false
        });
      })
      .then(function (participation) {
        return cb(null, participation.id);
      })
      .done();
  };

  //Tally.remoteMethod(
  //  'tallyInfo', {
  //    description: 'Get tally info.',
  //    accepts: [{
  //      arg: 'tallyId',
  //      type: 'number',
  //      required: true
  //    }],
  //    returns: [{
  //      arg: 'tally',
  //      type: 'Tally'
  //    }, {
  //      arg: 'memberIds',
  //      type: ['number'],
  //      description: 'The member id of participation, the first one is the administrator\'s id.'
  //    }],
  //    http: {
  //      verb: 'post',
  //      path: '/:tallyId/info'
  //    }
  //  }
  //);
  //Tally.tallyInfo = function(id, cb) {
  //  console.log(id);
  //
  //  //todo: check args
  //  Q.all([
  //    Tally.findById(id),
  //    Tally.app.models.Participation.find({
  //      where: {
  //        tallyId: id
  //      }
  //    }, {})
  //  ]).spread(function(tally, participations) {
  //    console.log(tally);
  //    console.log(participations);
  //    var memberIds =
  //      participations.sort(function(a, b) {
  //        return a.isAdmin ? -1 : 1;
  //      })
  //      .map(function(p) {
  //        return p.memberId;
  //      });
  //    cb(null, tally, memberIds);
  //  }).done();
  //};

  Tally.remoteMethod(
    'calculate', {
      description: 'Calculate the specified details.',
      accepts: [{
        arg: 'tallyId',
        type: 'number',
        required: true
      },{
        arg: 'detailIds',
        type: ['number']
      }],
      returns: [{
        arg: 'result',
        type: ['object']
      }],
      http: {
        verb: 'post',
        path: '/:tallyId/calculate'
      }
    }
  );
  Tally.calculate = function (tallyId, detailIds, cb) {
    Q.all([
      Tally.app.models.Detail.find({
        where: {
          tallyId: tallyId,
          id: {
            inq: detailIds
          },
          actorId: {
            neq: null
          }
        }
      }),
      Tally.app.models.Participation.find({
        where: {
          tallyId: tallyId
        }
      }, {})
    ]).spread(function (details, participations) {
      var partnerIds = participations.map(function (p) {
        return p.memberId;
      });
      cb(null, Tally._calculate(partnerIds, details));
    });
  };

  Tally.remoteMethod(
    'markDetailSettled', {
      description: 'Mark the specified details settled.',
      accepts: [{
        arg: 'tallyId',
        type: 'number',
        required: true
      },{
        arg: 'detailIds',
        type: ['number']
      }],
      returns: [{
        arg: 'detailIds',
        type: ['number']
      }],
      http: {
        verb: 'post',
        path: '/:tallyId/markDetailSettled'
      }
    }
  );
  Tally.markDetailSettled = function (tallyId, detailIds, cb) {
    Tally.app.models.Detail.update({
      tallyId: tallyId,
      id: {
        inq: detailIds
      }
    }, {
      isSettled: true
    }).then(function (result) {
      return cb(null, detailIds);
    })
  };


  Tally._calculate = function (partnerIds, details) {
    if (!Array.isArray(details)) return null;
    if (!Array.isArray(partnerIds)) return null;

    var results = {};
    partnerIds.forEach(function (partnerId) {
      results[partnerId] = {
        memberId: partnerId,
        receivable: 0
      };
    });
    var n = partnerIds.length;

    if (n == 1) { return results; }

    details.forEach(function (detail) {
      var target = Array.isArray(detail.target) && detail.target.length > 0 ? detail.target : partnerIds;

      var v = detail.value / target.length;
      var sum = 0; //deal with a tail difference
      target.forEach(function (memberId) {
        results[memberId].receivable -= v;
        sum += v;
      });
      results[detail.actorId].receivable += sum;
    });

    return results;
  }
};
