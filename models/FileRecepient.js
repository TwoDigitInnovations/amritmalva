const mongoose = require('mongoose');

const fileRecepientSchema = new mongoose.Schema({

  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },

  file_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },

  isRead: {
    type: Boolean,
    default: false,
  },
  seen_on: {
    type: Date,

  },

  seen_on_date_time_string: {
    type: String,
  },

}, {
  versionKey: false,
});

const FileRecepient = mongoose.model('FileRecepient', fileRecepientSchema);
module.exports = FileRecepient;
