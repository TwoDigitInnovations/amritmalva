const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({

  logType: {
    type: String, // Login, Logout
  },
  punch_in_date_time: {
    type: Date,
  },

  punch_in_date_string: {
    type: String,
  },

  punch_in_time_string: {
    type: String,
  },

  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },
  delete_By: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },

  deleted_on: {
    type: Date,
  },

}, {
  versionKey: false,
});

const LoginLog = mongoose.model('LoginLog', loginLogSchema);
module.exports = LoginLog;
