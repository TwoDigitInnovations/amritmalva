const mongoose = require('mongoose');

const attendancechema = new mongoose.Schema({

  status: {
    type: String,
    enum: ['PunchedIn', 'PunchedOut', 'Absent', 'OnLeave'],
    default: 'Absent',
  },

  punch_in_date_time: {
    type: Date,
  },
  punch_out_date_time: {
    type: Date,
  },
  punch_in_date_string: {
    type: String,
  },
  punch_out_date_string: {
    type: String,
  },
  punch_in_time_string: {
    type: String,
  },
  punch_out_time_string: {
    type: String,
  },
  totalTimeInHours: {
    type: Number,
    default: 0,
  },

  punch_in_address: {
    type: String,
  },

  punch_inLocationCoordinates: {
    type: [Number],
    index: '2d', // 0 index longi, 1 index lati
  },
  punch_outLocationCoordinates: {
    type: [Number],
    index: '2d', // 0 index longi, 1 index lati
  },

  punch_out_address: {
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

  distanceTravelForTheDay: {
    type: Number,
    default: 0,
  },
  distanceToPunchOutLocFromLastVisitLoc: {
    type: Number,
    default: 0,
  },
  noOfLocationCountForTheDay: {
    type: Number,
    default: 0,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  isAutoPunchOut: {
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

const Attendance = mongoose.model('Attendance', attendancechema);
module.exports = Attendance;
