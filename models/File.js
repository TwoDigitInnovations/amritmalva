const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({

  title: {
    type: String,
    trim: true,
  },
  path: {
    type: String,
    trim: true,
  },
  fileType: {
    type: String,
    trim: true,
  },
  fileName: {
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

const File = mongoose.model('File', fileSchema);
module.exports = File;
