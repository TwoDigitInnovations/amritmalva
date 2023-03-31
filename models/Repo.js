const mongoose = require('mongoose');

const repoSchema = new mongoose.Schema({

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
  nearestPoliceStation: {
    type: String,
  },

  locationAddress: {
    type: String,
  },

  isRCAvailable: {
    type: Boolean,
    default: false,
  },

  rcFrontImagePath: {
    type: String,
  },

  rcBackImagePath: {
    type: String,
  },

  bikeBackImagePath: {
    type: String,
  },
  bikeFrontImagePath: {
    type: String,
  },
  bikeTopImagePath: {
    type: String,
  },
  bikeLeftImagePath: {
    type: String,
  },
  bikeRightImagePath: {
    type: String,
  },

  punch_inLocationCoordinates: {
    type: [Number],
    index: '2d', // 0 index longi, 1 index lati
  },

  
  staff_id: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  }],

  employee_name:{
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

const Repo = mongoose.model('Repo', repoSchema);
module.exports = Repo;
