/* eslint-disable consistent-return */
/* eslint-disable camelcase */
/* eslint-disable no-underscore-dangle */
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');

const _Staff = require('../models/Staff');

// Setup work and export for the JWT passport strategy
module.exports = function (passport) {
  const opts = {};

  opts.secretOrKey = process.env.SECRET_KEY;

  // for other simple users authentication
  opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('jwt');
  passport.use('jwt', new JwtStrategy(opts, ((jwt_payload, done) => {
    const id = jwt_payload._id;

    _Staff.findOne({ _id: id }, (err, user) => {
      if (err) {
        return done(err, false);
      }
      if (user) {
        done(null, user);
      } else {
        done(null, false);
      }
    });
  })));
};
