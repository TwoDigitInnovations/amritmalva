/* eslint-disable func-names */
/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
// third parties
const nLog = require('noogger');
const moment = require('moment-timezone');

// controllers
const commonCtrl = require('./commonCtrl');

// models
const Message = require('../models/Message');
const MessageRecepient = require('../models/MessageRecepient');
const FileRecepient = require('../models/FileRecepient');
const File = require('../models/File');

exports.getMyMessages = async function (req, res) {
  const respObj = {
    IsSuccess: false,
    Message: 'OK',
    Data: null,
  };
  try {
    if (!req.body.id) {
      respObj.Message = 'User id missing.';
      return res.json(respObj);
    }

    const userIdPass = commonCtrl.isValidMongoId(req.body.id);

    if (!userIdPass) {
      respObj.Message = 'Invalid user id passed.';
      return res.json(respObj);
    }

    const myMessages = await MessageRecepient
      .find({
        staff_id: req.body.id,
        branch_id: req.body.branch_id,
        isDeleted: false,
      }).populate([{
        path: 'message_id',
        model: 'Message',
        select: '_id content created_on_string created_on created_By_Admin created_By_Manager',
        populate: [
          {
            path: 'created_By_Admin',
            model: 'Admin',
            select: '_id firstName lastName',

          },
          {
            path: 'created_By_Manager',
            model: 'Staff',
            select: '_id name',

          },
        ],
      }, {
        path: 'branch_id',
        model: 'Branch',
        select: '_id name',
      },

      ]);

    respObj.Data = myMessages;

    const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
    const punch_in_date_string = moment(punchInDateTime).format('DD-MM-YYYY');
    const punch_in_time_string = moment(punchInDateTime).format('hh:mm A');

    // marking all as read
    await MessageRecepient.updateMany(
      {
        staff_id: req.body.id,
        branch_id: req.body.branch_id,
        isDeleted: false,
        isRead: false,
      },
      {
        $set:
            {
              isRead: true,
              seen_on: punchInDateTime,
              seen_on_date_time_string: `${punch_in_date_string} ${punch_in_time_string}`,
            },
      },
      { multi: true },
    );

    respObj.IsSuccess = true;
    respObj.Message = 'OK.';
    return res.json(respObj);
  } catch (ex) {
    console.log('Server error in StaffCtrl->getMyProfile');
    console.error(ex);
    respObj.Message = 'Server Error.';
    nLog.error(`Error while reading messages for ${req.body.id}`);
    return res.json(respObj);
  }
};
exports.getMyFiles = async function (req, res) {
  const respObj = {
    IsSuccess: false,
    Message: 'OK',
    Data: null,
  };
  try {
    if (!req.body.id) {
      respObj.Message = 'User id missing.';
      return res.json(respObj);
    }

    const userIdPass = commonCtrl.isValidMongoId(req.body.id);

    if (!userIdPass) {
      respObj.Message = 'Invalid user id passed.';
      return res.json(respObj);
    }

    const myFiles = await FileRecepient
      .find({
        staff_id: req.body.id,
        branch_id: req.body.branch_id,
        isDeleted: false,
      }).populate([{
        path: 'file_id',
        model: 'File',
        select: '_id title path fileType fileName created_on_string created_on created_By_Admin created_By_Manager',
        populate: [
          {
            path: 'created_By_Admin',
            model: 'Admin',
            select: '_id firstName lastName',

          },
          {
            path: 'created_By_Manager',
            model: 'Staff',
            select: '_id name',

          },
        ],
      }, {
        path: 'branch_id',
        model: 'Branch',
        select: '_id name',
      },

      ]);

    respObj.Data = myFiles;

    const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
    const punch_in_date_string = moment(punchInDateTime).format('DD-MM-YYYY');
    const punch_in_time_string = moment(punchInDateTime).format('hh:mm A');

    // marking all as read
    await FileRecepient.updateMany(
      {
        staff_id: req.body.id,
        branch_id: req.body.branch_id,
        isDeleted: false,
        isRead: false,
      },
      {
        $set:
            {
              isRead: true,
              seen_on: punchInDateTime,
              seen_on_date_time_string: `${punch_in_date_string} ${punch_in_time_string}`,
            },
      },
      { multi: true },
    );

    respObj.IsSuccess = true;
    respObj.Message = 'OK.';
    return res.json(respObj);
  } catch (ex) {
    console.log('Server error in StaffCtrl->getMyFiles');
    console.error(ex);
    respObj.Message = 'Server Error.';
    nLog.error(`Error while reading messages for ${req.body.id}`);
    return res.json(respObj);
  }
};
