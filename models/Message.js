const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({

  content: {
    type: String,
    trim: true,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },

  created_on: {
    type: Date,

  },

  created_on_string: String,

  created_By_Admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  created_By_Manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  },
  deliveredTo: {
    type: String,
    enum: ['All Staff', 'Branch', 'All', 'Individual Staff'],
    default: 'All',
  },

}, {
  versionKey: false,
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
