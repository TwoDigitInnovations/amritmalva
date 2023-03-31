const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({

  visit_type: {
    type: String,
    enum: ['Customer visit', 'FI visit', 'REPO visit', 'Bank visit', 'Branch visit', 'Courier/ File Transport Visit', 'Police Station visit', 'Dealer Visit', 'H.O visit', 'Other Visit'],
    default: 'Other Visit',
  },

  offline_sync_server_date_time: {
    type: Date,
  },

  offline_sync_server_date_string: {
    type: String,
  },
  offline_sync_server_time_string: {
    type: String,
  },

  punch_date_time: {
    type: Date,
  },

  punch_date_string: {
    type: String,
  },
  punch_time_string: {
    type: String,
  },
  loanNo: {
    type: String,
  },
  partyName: {
    type: String,
  },
  partySDWO: {
    type: String,
  },
  partySDWOName: {
    type: String,
  },
  partyPhone: {
    type: String,
  },
  remarks: {
    type: String,
  },
  locationAddress: {
    type: String,
  },

  punch_inLocationCoordinates: {
    type: [Number],
    index: '2d', // 0 index longi, 1 index lati
  },

  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },

  distanceTillThispoint: {
    type: Number,
    default: 0,
  },
  distanceToThispoint: {
    type: Number,
    default: 0,
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

  isOfflineSynced: {
    type: Boolean,
    default: false,
  },

}, {
  versionKey: false,
});

const Visit = mongoose.model('Visit', visitSchema);
module.exports = Visit;
