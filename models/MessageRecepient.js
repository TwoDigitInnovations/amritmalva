const mongoose = require('mongoose');

const messageRecepientSchema = new mongoose.Schema({

  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },

  message_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
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

const MessageRecepient = mongoose.model('MessageRecepient', messageRecepientSchema);
module.exports = MessageRecepient;
