const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({

  fromDate: {
    type: Date,
  },

  fromDateString: {
    type: String,
  },
  toDateString: {
    type: String,
  },

  toDate: {
    type: Date,
  },

  appliedOn: {
    type: Date,
  },
  appliedOnDateString: {
    type: String,
  },
  appliedOnTimeString: {
    type: String,
  },
  fromTimeString: {
    type: String,
  },
  toTimeString: {
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
  leave_type: {
    type: String,
    enum: ['Full day', 'Half day', 'Short'],
    default: 'Full day',
  },
  remarks: {
    type: String,
  },
  approvedBy: {
    type: String,
  },

}, {
  versionKey: false,
});

const Leave = mongoose.model('Leave', leaveSchema);
module.exports = Leave;
