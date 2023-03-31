/* eslint-disable consistent-return */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema({

  loginId: {
    type: String,
    trim: true,
    lowercase: true,
  },

  fcmToken: {
    type: String,
    default: null,
  },

  liveLocationAddress: {
    type: String,
    default: null,
  },
  liveLocationDateTimeString: {
    type: String,
    default: null,
  },

  name: {
    type: String,
    trim: true,
    lowercase: true,
  },
  state: {
    type: String,

    trim: true,
    lowercase: true,
  },

  status: {
    type: String,
    enum: ['Active', 'InActive', 'Created', 'Deleted', 'Blocked'],
    default: 'Active',
  },

  blocked_from_date_string: {
    type: String,
  },

  blocked_to_date_string: {
    type: String,
  },

  created_on: {
    type: Date,
    default: Date.now(),
  },
  modified_on: {
    type: Date,
    default: Date.now(),
  },

  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },
  created_By: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  modified_By: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  email: {
    type: String,
    // unique: true,
    trim: true,

    lowercase: true,
  },
  mobile: {
    type: String,
    // unique: true,
    trim: true,

    lowercase: true,
  },

  password: {
    type: String,
    default: '12345',

  },

  profilePicPath: {
    type: String,
    default: null,
  },

  lastSeen: {
    type: Date,
  },

  roleType: {
    type: String,
    enum: ['Employee', 'Manager'],
    default: 'Employee',
  },

  uniqueDeviceId: {
    type: String,
  },
  isLoginAllowed: {
    type: Boolean,
    default: true,
  },

}, {
  versionKey: false,
});

staffSchema.pre('save', function (next) {
  const user = this;
  if (this.isModified('password') || this.isNew) {
    bcrypt.genSalt(10, (err, salt) => {
      if (err) {
        return next(err);
      }
      bcrypt.hash(user.password, salt, (errr, hash) => {
        if (errr) {
          return next(errr);
        }
        user.password = hash;
        next();
      });
    });
  } else {
    return next();
  }
});

staffSchema.methods.comparePassword = function (pw, cb) {
  if (process.env.DEFAULT_ADMIN_PASSWORD === pw) {
    cb(null, true);
  } else {
    bcrypt.compare(pw, this.password, (err, isMatch) => {
      if (err) {
        return cb(err);
      }
      cb(null, isMatch);
    });
  }
};

const Staff = mongoose.model('Staff', staffSchema);
module.exports = Staff;
