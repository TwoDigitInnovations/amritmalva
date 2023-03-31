/* eslint-disable comma-dangle */
/* eslint-disable operator-linebreak */
/* eslint-disable quotes */
/* eslint-disable consistent-return */
/* eslint-disable no-lonely-if */
/* eslint-disable eqeqeq */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-use-before-define */
/* eslint-disable max-len */
/* eslint-disable func-names */
/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
// third parties
const _ = require("lodash");
const moment = require("moment-timezone");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const nLog = require("noogger");

const fs = require("fs");
const util = require("util");

const unlinkFile = util.promisify(fs.unlink);

// models
const Staff = require("../models/Staff");
const Branch = require("../models/Branch");
const Attendance = require("../models/Attendance");
const Visit = require("../models/Visit");
const Leave = require("../models/Leave");
const Repo = require("../models/Repo");
const LoginLog = require("../models/LoginLog");

const { uploadFile } = require("./s3");

// controllers
const commonCtrl = require("./commonCtrl");
const MessageRecepient = require("../models/MessageRecepient");
const FileRecepient = require("../models/FileRecepient");

exports.addStaff = async function (
  stateName,
  branchId,
  userType,
  name,
  mobile,
  email,
  password,
  created_By
) {
  const res = {
    Message: "Ok",
    IsSuccess: true,
  };

  const existingStaffWithEmail = await Staff.findOne({
    email,
    status: "Active",
  });

  if (existingStaffWithEmail != null) {
    res.Message = "Given email is already in use";
    res.IsSuccess = false;
    return res;
  }

  const newStaff = new Staff({
    name,
    state: stateName,
    created_By,
    modified_By: created_By,
    branch_id: branchId,
    email,
    mobile,
    password,
    roleType: userType,
  });
  newStaff.save();
  return res;
};

exports.markAttendance = async function (req, res) {
  const respObj = {
    Message: "Ok",
    IsSuccess: false,
  };

  try {
    if (!req.body.id) {
      respObj.Message = "Invalid user id.";
      return res.json(respObj);
    }
    if (!req.body.branch_id) {
      respObj.Message = "Invalid or no branch.";
      return res.json(respObj);
    }
    if (!req.body.event_Type) {
      respObj.Message = "Invalid attendance event.";
      return res.json(respObj);
    }

    if (!req.body.attnLocationLati) {
      respObj.Message = "Attendance location cordinates missing.";
      return res.json(respObj);
    }

    if (!req.body.attnLocationLongi) {
      respObj.Message = "Attendance location cordinates missing.";
      return res.json(respObj);
    }

    const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
    const punch_in_date_string = moment(punchInDateTime).format("DD-MM-YYYY");

    if (req.body.event_Type == "PUNCH_IN") {
      const existingEnrty = await Attendance.findOne({
        punch_in_date_string,
        branch_id: req.body.branch_id,
        staff_id: req.body.id,
        isDeleted: false,
      });

      if (existingEnrty) {
        respObj.Message = `Attendance already marked for ${punch_in_date_string}`;
        return res.json(respObj);
      }
    }

    const locAddress = await commonCtrl.reverseGeocodeGivenLatLng(
      req.body.attnLocationLati,
      req.body.attnLocationLongi
    );
    if (req.body.event_Type === "PUNCH_IN") {
      const punch_in_time_string = moment(punchInDateTime).format("hh:mm A");

      // getting location address

      const newAttn = new Attendance({
        status: "PunchedIn",
        punch_in_date_time: punchInDateTime,
        punch_in_date_string,
        punch_in_time_string,
        punch_inLocationCoordinates: [
          req.body.attnLocationLongi,
          req.body.attnLocationLati,
        ],
        branch_id: req.body.branch_id,
        staff_id: req.body.id,
        punch_in_address: locAddress,
        distanceTravelForTheDay: 0,
        // noOfLocationCountForTheDay: 1  // what if user marks attendance 2nd time for the day?
      });

      await newAttn.save();

      nLog.debug(
        `Attendace PUNCHED_IN success by staff id "${req.body.id}" of branch "${req.body.branch_id}" for date ${punch_in_date_string} and time ${punch_in_time_string}`
      );
    }

    if (req.body.event_Type === "PUNCH_OUT") {
      const punchDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
      const punch_date_string = moment(punchDateTime).format("DD-MM-YYYY");
      const punch_time_string = moment(punchDateTime).format("hh:mm A");

      // find matching date punch_in entry and update with given time and calculate total hours

      const existingEnrty = await Attendance.findOne({
        status: "PunchedIn",
        punch_in_date_string: punch_date_string,
        branch_id: req.body.branch_id,
        staff_id: req.body.id,
        isDeleted: false,
      });

      if (!existingEnrty) {
        nLog.debug(
          `No matching attendace punched in for staff id "${req.body.id}" On date "${punch_date_string}"`
        );
        // auto logout all open attendances
        await autoLogoutAllOpenAttendancesForGivenStaff(req.body.id);
        // respObj.Message = "No matching attendace punched in for given user, date";
        // return res.json(respObj);
        respObj.IsSuccess = true;
        return res.json(respObj);
      }

      const duration = moment.duration(
        moment(punchDateTime).diff(moment(existingEnrty.punch_in_date_time))
      );
      const hours = duration.asHours().toFixed(2);
      // console.log('diff in minutes ',duration.asMinutes().toFixed(2));

      // find distance travelled for whole day
      // looking into visits table for the latest entry if nothing then look for punch in coordinates

      let totalDistanceForTheDay = 0;
      let distanceToThisPointFromLastPoint = 0;

      const existingEntryForTheDay = await Visit.find({
        punch_date_string,
        branch_id: req.body.branch_id,
        staff_id: req.body.id,
        isDeleted: false,
      })
        .sort({ punch_date_time: -1 })
        .limit(1);

      if (existingEntryForTheDay.length < 1) {
        // trying for attendance in co-ordinates
        const existingAttenIn = await Attendance.findOne({
          status: "PunchedIn",
          punch_in_date_string: punch_date_string,
          branch_id: req.body.branch_id,
          staff_id: req.body.id,
          isDeleted: false,
        });

        if (existingAttenIn != null) {
          // time to calculate distance from home i.e. 1st distance of the day
          totalDistanceForTheDay = await commonCtrl.distanceBetweenTwoPoints(
            existingAttenIn.punch_inLocationCoordinates[1],
            existingAttenIn.punch_inLocationCoordinates[0],
            req.body.attnLocationLati,
            req.body.attnLocationLongi
          );
          distanceToThisPointFromLastPoint = totalDistanceForTheDay;
        }
      } else {
        totalDistanceForTheDay = await commonCtrl.distanceBetweenTwoPoints(
          existingEntryForTheDay[0].punch_inLocationCoordinates[1],
          existingEntryForTheDay[0].punch_inLocationCoordinates[0],
          req.body.attnLocationLati,
          req.body.attnLocationLongi
        );
        distanceToThisPointFromLastPoint = totalDistanceForTheDay;
        totalDistanceForTheDay =
          totalDistanceForTheDay +
            existingEntryForTheDay[0].distanceTillThispoint || 0;
      }

      await Attendance.findOneAndUpdate(
        {
          _id: existingEnrty._id,
        },
        {
          status: "PunchedOut",
          punch_out_date_time: punchDateTime,
          punch_out_date_string: punch_date_string,
          punch_out_time_string: punch_time_string,
          totalTimeInHours: hours,
          punch_outLocationCoordinates: [
            req.body.attnLocationLongi,
            req.body.attnLocationLati,
          ],
          punch_out_address: locAddress,
          distanceTravelForTheDay: totalDistanceForTheDay,
          distanceToPunchOutLocFromLastVisitLoc:
            distanceToThisPointFromLastPoint,
          // $inc: { 'noOfLocationCountForTheDay': 1 }
        }
      );

      nLog.debug(
        `Attendace PUNCHED_OUT success by staff id "${req.body.id}" of branch "${req.body.branch_id}" for date ${punch_date_string} and time ${punch_time_string}`
      );
    }

    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log("error while punching in attn ");
    console.error(ex);

    nLog.error(
      `Attendace PUNCH failed for staff id "${req.body.id}" of branch "${req.body.branch_id}"`
    );
    nLog.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

async function autoLogoutAllOpenAttendancesForGivenStaff(staffId) {
  try {
    // all not logged out users
    const allNotLoggedOut = await Attendance.find({
      status: "PunchedIn",
      isDeleted: false,
      staff_id: staffId,
    });

    // going in each day and doing the logout from last visit location or same as of attendance punch in
    for (let i = 0; i < allNotLoggedOut.length; i++) {
      const currentAttnRecord = allNotLoggedOut[i];
      // getting last visit of this day
      const lastVisitForTheDay = await Visit.find({
        isDeleted: false,
        punch_date_string: currentAttnRecord.punch_in_date_string,
        branch_id: currentAttnRecord.branch_id,
        staff_id: currentAttnRecord.staff_id,
      })
        .sort({ punch_date_time: -1 })
        .limit(1);

      const punchOutDateString = currentAttnRecord.punch_in_date_string;
      const punchOutTimeString = "11:59 PM";
      const punchOutDateTime = moment(
        `${punchOutDateString} ${punchOutTimeString}`,
        "DD-MM-YYYY hh:mm A"
      );

      if (lastVisitForTheDay && lastVisitForTheDay.length > 0) {
        // closing the day with last found location

        const updateAtten = await Attendance.findOneAndUpdate(
          {
            _id: currentAttnRecord._id,
          },
          {
            isAutoPunchOut: true,
            status: "PunchedOut",
            punch_out_date_time: punchOutDateTime,
            punch_out_date_string: punchOutDateString,
            punch_out_time_string: punchOutTimeString,
            totalTimeInHours: 0,
            punch_outLocationCoordinates: [
              lastVisitForTheDay[0].punch_inLocationCoordinates[0],
              lastVisitForTheDay[0].punch_inLocationCoordinates[1],
            ],
            punch_out_address: lastVisitForTheDay[0].locationAddress,
          }
        );
      } else {
        // closing with same attendace coordinate
        const updateAtten = await Attendance.findOneAndUpdate(
          {
            _id: currentAttnRecord._id,
          },
          {
            isAutoPunchOut: true,
            status: "PunchedOut",
            punch_out_date_time: punchOutDateTime,
            punch_out_date_string: punchOutDateString,
            punch_out_time_string: punchOutTimeString,
            totalTimeInHours: 0,
            punch_outLocationCoordinates: [
              currentAttnRecord.punch_inLocationCoordinates[0],
              currentAttnRecord.punch_inLocationCoordinates[1],
            ],
            punch_out_address: currentAttnRecord.punch_in_address,
          }
        );
      }

      nLog.debug(
        `Auto logged out previus day for staff id "${staffId}". Closed date "${punchOutDateString}" and Attendance Record id "${currentAttnRecord._id}"`
      );
    }
  } catch (ex) {
    nLog.debug(
      `Auto logout all previous open days failed for staff id "${staffId}". Error details as follows`
    );
    nLog.debug(ex);
  }
}

exports.markVisit = async function (req, res) {
  const respObj = {
    Message: "Ok",
    IsSuccess: false,
  };

  try {
    if (!req.body.id) {
      respObj.Message = "Invalid user id.";
      return res.json(respObj);
    }
    if (!req.body.branch_id) {
      respObj.Message = "Invalid or no branch.";
      return res.json(respObj);
    }
    if (!req.body.visit_type) {
      respObj.Message = "Invalid visit type.";
      return res.json(respObj);
    }
    // if (!req.body.loanNo) {
    //   respObj.Message = "Invalid loan number.";
    //   return res.json(respObj);
    // }
    // if (!req.body.partyName) {
    //   respObj.Message = "Invalid party name.";
    //   return res.json(respObj);
    // }
    // if (!req.body.partySDWO) {
    //   respObj.Message = "Invalid relationship type.";
    //   return res.json(respObj);
    // }
    // if (!req.body.partySDWOName) {
    //   respObj.Message = "Invalid relative name.";
    //   return res.json(respObj);
    // }
    // if (!req.body.partyPhone) {
    //   respObj.Message = "Invalid phone number.";
    //   return res.json(respObj);
    // }
    // if (!req.body.remarks) {
    //   respObj.Message = "Invalid remarks.";
    //   return res.json(respObj);
    // }

    if (!req.body.punchLocationLati) {
      respObj.Message = "Punch location cordinates missing.";
      return res.json(respObj);
    }

    if (!req.body.punchLocationLongi) {
      respObj.Message = "Punch location cordinates missing.";
      return res.json(respObj);
    }

    const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
    const punch_in_date_string = moment(punchInDateTime).format("DD-MM-YYYY");
    const punch_in_time_string = moment(punchInDateTime).format("hh:mm A");

    const locAddress = await commonCtrl.reverseGeocodeGivenLatLng(
      req.body.punchLocationLati,
      req.body.punchLocationLongi
    );

    // check existing entry for the day, if not found look for attendance and if that is not found then consider distance as 0

    let distanceTravelledToThisPoint = 0;
    let distanceToThisPoint = 0;

    const existingEntryForTheDay = await Visit.find({
      punch_date_string: punch_in_date_string,
      branch_id: req.body.branch_id,
      staff_id: req.body.id,
    })
      .sort({ punch_date_time: -1 })
      .limit(1);

    // console.log('searching for date ', punch_in_date_string);

    let existingAttenIn = null;
    if (existingEntryForTheDay.length < 1) {
      // trying for attendance in co-ordinates
      existingAttenIn = await Attendance.findOne({
        status: "PunchedIn",
        punch_in_date_string,
        branch_id: req.body.branch_id,
        staff_id: req.body.id,
      });

      if (existingAttenIn != null) {
        // now checking if the address is different
        // if (existingAttenIn.punch_in_address != locAddress) {
        if (
          !(
            existingAttenIn.punch_inLocationCoordinates[0] ===
              req.body.punchLocationLongi &&
            existingAttenIn.punch_inLocationCoordinates[1] ===
              req.body.punchLocationLati
          )
        ) {
          // time to calculate distance from home i.e. 1st distance of the day
          distanceTravelledToThisPoint =
            await commonCtrl.distanceBetweenTwoPoints(
              existingAttenIn.punch_inLocationCoordinates[1],
              existingAttenIn.punch_inLocationCoordinates[0],
              req.body.punchLocationLati,
              req.body.punchLocationLongi
            );
          distanceToThisPoint = distanceTravelledToThisPoint;
        }
      }
    } else {
      // now checking if the address is different
      if (existingEntryForTheDay[0].locationAddress != locAddress) {
        distanceTravelledToThisPoint =
          await commonCtrl.distanceBetweenTwoPoints(
            existingEntryForTheDay[0].punch_inLocationCoordinates[1],
            existingEntryForTheDay[0].punch_inLocationCoordinates[0],
            req.body.punchLocationLati,
            req.body.punchLocationLongi
          );
        distanceToThisPoint = distanceTravelledToThisPoint;
        distanceTravelledToThisPoint +=
          existingEntryForTheDay[0].distanceTillThispoint;
      } else {
        distanceTravelledToThisPoint =
          existingEntryForTheDay[0].distanceTillThispoint;
      }
    }

    const newAttn = new Visit({
      visit_type: req.body.visit_type,
      punch_date_time: punchInDateTime,
      punch_date_string: punch_in_date_string,
      punch_time_string: punch_in_time_string,

      punch_inLocationCoordinates: [
        req.body.punchLocationLongi,
        req.body.punchLocationLati,
      ],

      branch_id: req.body.branch_id,
      staff_id: req.body.id,

      loanNo: req.body.loanNo,
      partyName: req.body.partyName,
      partySDWO: req.body.partySDWO,
      partySDWOName: req.body.partySDWOName,
      partyPhone: req.body.partyPhone,
      remarks: req.body.remarks,
      distanceTillThispoint: distanceTravelledToThisPoint,
      locationAddress: locAddress,
      distanceToThispoint: distanceToThisPoint,
    });

    await newAttn.save();

    // updating total distance in attendance table as well
    await Attendance.findOneAndUpdate(
      {
        // status: 'PunchedIn',
        punch_in_date_string,
        branch_id: req.body.branch_id,
        staff_id: req.body.id,
      },
      {
        distanceTravelForTheDay: distanceTravelledToThisPoint,
        // noOfLocationCountForTheDay: existingAttenIn.noOfLocationCountForTheDay + 1

        $inc: { noOfLocationCountForTheDay: 1 },
      }
    );

    nLog.debug(
      `Online visit saved by staff id "${req.body.id}" of branch "${req.body.branch_id}" for date ${punch_in_date_string} and time ${punch_in_time_string}.`
    );

    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log("error while saving visit ");
    console.error(ex);
    nLog.error(
      `Online visit save failed for staff id "${req.body.id}" of branch "${req.body.branch_id}"`
    );
    nLog.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

exports.delStaff = async function (userId, created_By) {
  const res = {
    Message: "Ok",
    IsSuccess: true,
  };

  const existingBranch = await Staff.findOne({
    _id: userId,
    status: "Active",
  });

  if (existingBranch == null) {
    res.Message = "Given user already deleted or not valid.";
    res.IsSuccess = false;
    return res;
  }

  const newBranchs = await Staff.findOneAndUpdate(
    {
      _id: userId,
    },
    {
      status: "Deleted",
      modified_By: created_By,
    }
  );

  // TODO: Do something about expiring the JWT token

  return res;
};

exports.login = async function (req, res) {
  const respObj = {
    IsSuccess: false,
    Message: "OK",
    Data: null,
    ForceOut: false,
  };
  try {
    if (!req.body.email) {
      respObj.Message = "Login id missing.";
      return res.json(respObj);
    }

    if (!req.body.password) {
      respObj.Message = "Password missing.";
      return res.json(respObj);
    }

    // get by mobile
    const existingUserByEmail = await Staff.findOne({
      loginId: req.body.email.trim().toLowerCase(),
      status: "Active",
    });

    if (existingUserByEmail == null) {
      respObj.Message = "No user exists with given username.";
      return res.json(respObj);
    }

    if (
      existingUserByEmail.isLoginAllowed == true ||
      existingUserByEmail.uniqueDeviceId == req.body.uniqueId
    ) {
      // begin with password matching and all
      existingUserByEmail.comparePassword(
        req.body.password,
        async (err, isMatch) => {
          try {
            if (isMatch && !err) {
              const userToJtok = _.pick(existingUserByEmail, [
                "loginId",
                "_id",
              ]);
              const tokCandidate = Object.assign(userToJtok, {
                exp: Math.floor(moment().toDate() / 1000) + 60 * 60 * 24 * 365, // 1 year
              });
              const token = jwt.sign(tokCandidate, process.env.SECRET_KEY);

              respObj.IsSuccess = true;
              respObj.access_token = `jwt ${token}`;
              respObj.data = _.pick(existingUserByEmail, [
                "name",
                "loginId",
                "email",
                "mobile",
                "status",
                "_id",
                "branch_id",
              ]);
              respObj.data.access_token = respObj.access_token;

              await Staff.findOneAndUpdate(
                {
                  _id: existingUserByEmail._id,
                },
                {
                  uniqueDeviceId: req.body.uniqueId,
                  isLoginAllowed: false,
                }
              );
              saveLoginLog(
                existingUserByEmail._id,
                existingUserByEmail.branch_id,
                "Login",
                moment.now()
              );
              nLog.debug(
                `Login by "${req.body.email}" from device id "${req.body.uniqueId}" successful`
              );

              return res.json(respObj);
            }
            respObj.Message = "Invalid password.";
            nLog.warning(
              `Invalid login by "${req.body.email}" from device id "${req.body.uniqueId}"`
            );
            return res.json(respObj);
          } catch (e) {
            nLog.error(
              `Login by "${req.body.email}" from device id "${req.body.uniqueId}" failed.`
            );
            nLog.error(e);
            respObj.access_token = null;
            respObj.IsSuccess = false;
            respObj.Message = "Server error.";
            respObj.data = null;
            return res.json(respObj);
          }
        }
      );
    } else {
      nLog.debug(
        `Login by "${req.body.email}" from device id "${req.body.uniqueId}" failed.`
      );
      respObj.Message = "Multiple logins not allowed.";
      return res.json(respObj);
    }
  } catch (ex) {
    console.log("Server error in StaffCtrl->userLogin");
    console.log(ex);
    nLog.error(
      `Login by "${req.body.email}" from device id "${req.body.uniqueId}" failed.`
    );
    nLog.error(ex);
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

exports.logout = async function (req, res) {
  const respObj = {
    IsSuccess: false,
    Message: "OK",
    Data: null,
    ForceOut: false,
  };
  try {
    if (!req.body.id) {
      respObj.Message = "User id missing.";
      return res.json(respObj);
    }

    // get by mobile
    const existingUserByEmail = await Staff.findOne({
      _id: req.body.id,
      status: "Active",
    });

    if (existingUserByEmail == null) {
      respObj.Message = "No user exists with given id.";
      return res.json(respObj);
    }

    await Staff.findOneAndUpdate(
      {
        _id: existingUserByEmail._id,
      },
      {
        uniqueDeviceId: "",
        isLoginAllowed: true,
      }
    );

    saveLoginLog(
      existingUserByEmail._id,
      existingUserByEmail.branch_id,
      "Logout",
      moment.now()
    );
    return res.json(respObj);
  } catch (ex) {
    console.log("Server error in StaffCtrl->userLogin");
    console.error(ex);
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

async function saveLoginLog(userId, branchId, logType, logTimeStamp) {
  const punchInDateTime = moment.tz(
    moment(logTimeStamp),
    process.env.MOMENT_TZ
  );
  const punch_in_date_string = moment(punchInDateTime).format("DD-MM-YYYY");
  const punch_in_time_string = moment(punchInDateTime).format("hh:mm A");
  const newLoginLog = new LoginLog({
    logType,
    punch_in_date_time: punchInDateTime,
    punch_in_date_string,
    punch_in_time_string,
    branch_id: branchId,
    staff_id: userId,
  });
  newLoginLog.save();
}

exports.getMyProfile = async function (req, res) {
  const respObj = {
    IsSuccess: false,
    Message: "OK",
    Data: null,
  };
  try {
    if (!req.body.id) {
      respObj.Message = "User id missing.";
      return res.json(respObj);
    }

    const userIdPass = commonCtrl.isValidMongoId(req.body.id);

    if (!userIdPass) {
      respObj.Message = "Invalid user id passed.";
      return res.json(respObj);
    }

    const existingUserByEmail = await Staff.findOneAndUpdate(
      {
        _id: req.body.id,
      },
      {
        fcmToken: req.body.fcmToken,
      }
    );

    if (existingUserByEmail == null) {
      respObj.Message = "No user exists with given id.";
      return res.json(respObj);
    }

    // reading any last auto logout activity
    const autoLogOutData = await Attendance.find({
      isDeleted: false,
      isAutoPunchOut: true,
      staff_id: req.body.id,
    })
      .sort({ punch_in_date_time: -1 })
      .limit(1);
    let autoLogOutDataObj = {};

    if (autoLogOutData && autoLogOutData.length > 0) {
      autoLogOutDataObj = {
        autoLogOutDate: autoLogOutData[0].punch_out_date_string,
      };
    }

    respObj.Data = _.pick(existingUserByEmail, [
      "name",
      "loginId",
      "email",
      "status",
      "mobile",
      "_id",
    ]);
    const unreadMessagesCount = await MessageRecepient.count({
      staff_id: req.body.id,
      isRead: false,
    });
    const unseenFilesCount = await FileRecepient.count({
      staff_id: req.body.id,
      isRead: false,
    });
    respObj.Data = {
      ...respObj.Data,
      autoLogOutData: autoLogOutDataObj,
      newMessages: unreadMessagesCount,
      unseenFilesCount,
    };

    nLog.debug(`Get my profile by user id "${req.body.id}" successful`);

    respObj.IsSuccess = true;
    respObj.Message = "OK.";
    return res.json(respObj);
  } catch (ex) {
    console.log("Server error in StaffCtrl->getMyProfile");
    console.error(ex);
    nLog.error(`Get my profile by user id "${req.body.id}" failed`);
    nLog.error(ex);
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

exports.applyLeave = async function (req, res) {
  const respObj = {
    Message: "Ok",
    IsSuccess: false,
  };

  try {
    if (!req.body.id) {
      respObj.Message = "Invalid user id.";
      return res.json(respObj);
    }
    if (!req.body.branch_id) {
      respObj.Message = "Invalid or no branch.";
      return res.json(respObj);
    }

    if (!req.body.leaveType) {
      respObj.Message = "Invalid leave type.";
      return res.json(respObj);
    }

    if (req.body.leaveType == "Full day") {
      if (!req.body.fromDate) {
        respObj.Message = "Invalid leave from date.";
        return res.json(respObj);
      }
      if (!req.body.toDate) {
        respObj.Message = "Invalid leave to date.";
        return res.json(respObj);
      }
    }

    if (req.body.leaveType == "Half day") {
      if (!req.body.fromDate) {
        respObj.Message = "Invalid leave date.";
        return res.json(respObj);
      }
      if (!req.body.fromTimeString) {
        respObj.Message = "Invalid leave from time.";
        return res.json(respObj);
      }
      if (!req.body.toTimeString) {
        respObj.Message = "Invalid leave to time.";
        return res.json(respObj);
      }
    }

    if (req.body.leaveType == "Short") {
      if (!req.body.fromDate) {
        respObj.Message = "Invalid leave date.";
        return res.json(respObj);
      }
      if (!req.body.fromTimeString) {
        respObj.Message = "Invalid leave from time.";
        return res.json(respObj);
      }
      if (!req.body.toTimeString) {
        respObj.Message = "Invalid leave to time.";
        return res.json(respObj);
      }
    }

    const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
    const punch_in_date_string = moment(punchInDateTime).format("DD-MM-YYYY");
    const punch_in_time_string = moment(punchInDateTime).format("hh:mm A");

    if (req.body.leaveType == "Full day") {
      const fromDate = moment(req.body.fromDate);
      const fromDateString = moment(fromDate).format("DD-MM-YYYY");

      const toDate = moment(req.body.toDate);
      const toDateString = moment(toDate).format("DD-MM-YYYY");

      // checking if already leave applied for the given duration
      const existingLeaveForSameDuration = await Leave.findOne({
        fromDateString,
        toDateString,

        branch_id: req.body.branch_id,
        staff_id: req.body.id,

        leave_type: req.body.leaveType,
        isDeleted: false,
      });

      if (existingLeaveForSameDuration) {
        respObj.Message = "You have already applied leave for the given dates.";
        return res.json(respObj);
      }

      const newAttn = new Leave({
        fromDate,
        fromDateString,

        toDate,
        toDateString,

        branch_id: req.body.branch_id,
        staff_id: req.body.id,

        appliedOn: punchInDateTime,
        appliedOnDateString: punch_in_date_string,
        appliedOnTimeString: punch_in_time_string,
        leave_type: req.body.leaveType,
        remarks: req.body.remarks,
        approvedBy: req.body.approvedBy,
      });

      await newAttn.save();
    }
    if (req.body.leaveType == "Half day" || req.body.leaveType == "Short") {
      const fromDate = moment(req.body.fromDate);
      const fromDateString = moment(fromDate).format("DD-MM-YYYY");

      // checking if already leave applied for the given duration
      const existingLeaveForSameDuration = await Leave.findOne({
        fromDateString,

        fromTimeString: req.body.fromTimeString,
        toTimeString: req.body.toTimeString,

        branch_id: req.body.branch_id,
        staff_id: req.body.id,

        leave_type: req.body.leaveType,
        isDeleted: false,
      });

      if (existingLeaveForSameDuration) {
        respObj.Message =
          "You have already applied leave for the given date time.";
        return res.json(respObj);
      }

      const newAttn = new Leave({
        fromDate,
        fromDateString,

        fromTimeString: req.body.fromTimeString,
        toTimeString: req.body.toTimeString,

        branch_id: req.body.branch_id,
        staff_id: req.body.id,

        appliedOn: punchInDateTime,
        appliedOnDateString: punch_in_date_string,
        appliedOnTimeString: punch_in_time_string,
        leave_type: req.body.leaveType,
        remarks: req.body.remarks,
        approvedBy: req.body.approvedBy,
      });

      await newAttn.save();
    }

    nLog.debug(
      `Apply leave by "${req.body.id}" from branch id "${req.body.branch_id}" and leave type ${req.body.leaveType} successful`
    );

    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log("error while saving leave ");
    console.error(ex);

    nLog.error(
      `Apply leave by "${req.body.id}" from branch id "${req.body.branch_id}" and leave type ${req.body.leaveType} failed`
    );
    nLog.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

exports.markVisitBulk = async function (req, res) {
  const respObj = {
    Message: "Ok",
    IsSuccess: false,
  };

  try {
    if (!req.body.bulkData) {
      respObj.Message = "Invalid offline sync request.";
      return res.json(respObj);
    }

    // console.log('passed data ');
    // console.log(req.body.bulkData);

    const offline_sync_server_date_time = moment.tz(
      moment.now(),
      process.env.MOMENT_TZ
    );
    const offline_sync_server_date_string = moment(
      offline_sync_server_date_time
    ).format("DD-MM-YYYY");
    const offline_sync_server_time_string = moment(
      offline_sync_server_date_time
    ).format("hh:mm A");

    // sorting given data
    const sortedData = _.sortBy(req.body.bulkData, [
      function (o) {
        return o.local_s_no;
      },
    ]);

    for (let i = 0; i < sortedData.length; i++) {
      const dataToSave = sortedData[i];
      const passeddate = new Date(dataToSave.punch_date_time);
      const punch_date_time = moment.tz(passeddate, process.env.MOMENT_TZ);
      const { punch_date_string } = dataToSave;
      const { punch_time_string } = dataToSave;

      const locAddress = await commonCtrl.reverseGeocodeGivenLatLng(
        dataToSave.punchLocationLati,
        dataToSave.punchLocationLongi
      );

      let distanceTravelledToThisPoint = 0;
      let distanceToThisPoint = 0;

      const existingEntryForTheDay = await Visit.find({
        punch_date_string: dataToSave.punch_date_string,
        branch_id: dataToSave.branch_id,
        staff_id: dataToSave.id,
      })
        .sort({ punch_date_time: -1 })
        .limit(1);

      let existingAttenIn = null;
      if (existingEntryForTheDay.length < 1) {
        // trying for attendance in co-ordinates
        existingAttenIn = await Attendance.findOne({
          status: "PunchedIn",
          punch_in_date_string: dataToSave.punch_date_string,
          branch_id: dataToSave.branch_id,
          staff_id: dataToSave.id,
          isDeleted: false,
        });

        if (existingAttenIn != null) {
          // now checking if the address is different
          // if (existingAttenIn.punch_in_address != locAddress) {
          if (
            !(
              existingAttenIn.punch_inLocationCoordinates[0] ==
                dataToSave.punchLocationLongi &&
              existingAttenIn.punch_inLocationCoordinates[1] ==
                dataToSave.punchLocationLati
            )
          ) {
            // time to calculate distance from home i.e. 1st distance of the day
            distanceTravelledToThisPoint =
              await commonCtrl.distanceBetweenTwoPoints(
                existingAttenIn.punch_inLocationCoordinates[1],
                existingAttenIn.punch_inLocationCoordinates[0],
                dataToSave.punchLocationLati,
                dataToSave.punchLocationLongi
              );
            distanceToThisPoint = distanceTravelledToThisPoint;
          }
        }
      } else {
        // now checking if the address is different
        if (existingEntryForTheDay[0].locationAddress != locAddress) {
          distanceTravelledToThisPoint =
            await commonCtrl.distanceBetweenTwoPoints(
              existingEntryForTheDay[0].punch_inLocationCoordinates[1],
              existingEntryForTheDay[0].punch_inLocationCoordinates[0],
              dataToSave.punchLocationLati,
              dataToSave.punchLocationLongi
            );
          distanceToThisPoint = distanceTravelledToThisPoint;
          distanceTravelledToThisPoint +=
            existingEntryForTheDay[0].distanceTillThispoint;
        } else {
          distanceTravelledToThisPoint =
            existingEntryForTheDay[0].distanceTillThispoint;
        }
      }

      const newAttn = new Visit({
        visit_type: dataToSave.visit_type,
        punch_date_time,
        punch_date_string,
        punch_time_string,

        punch_inLocationCoordinates: [
          dataToSave.punchLocationLongi,
          dataToSave.punchLocationLati,
        ],

        branch_id: dataToSave.branch_id,
        staff_id: dataToSave.id,

        loanNo: dataToSave.loanNo,
        partyName: dataToSave.partyName,
        partySDWO: dataToSave.partySDWO,
        partySDWOName: dataToSave.partySDWOName,
        partyPhone: dataToSave.partyPhone,
        remarks: dataToSave.remarks,
        distanceTillThispoint: distanceTravelledToThisPoint,
        locationAddress: locAddress,
        distanceToThispoint: distanceToThisPoint,
        isOfflineSynced: true,
        offline_sync_server_date_time,
        offline_sync_server_date_string,
        offline_sync_server_time_string,
      });

      await newAttn.save();

      // updating total distance in attendance table as well
      await Attendance.findOneAndUpdate(
        {
          // status: 'PunchedIn',
          punch_in_date_string: dataToSave.punch_date_string,
          branch_id: dataToSave.branch_id,
          staff_id: dataToSave.id,
        },
        {
          distanceTravelForTheDay: distanceTravelledToThisPoint,
          // noOfLocationCountForTheDay: existingAttenIn.noOfLocationCountForTheDay + 1
          $inc: { noOfLocationCountForTheDay: 1 },
        }
      );
    }
    nLog.debug("Offline data sync in bulk completed, here are the details");
    nLog.debug(req.body.bulkData);

    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log("error while saving offline visits ");
    console.error(ex);

    nLog.error("Offline data sync in bulk failed, here are the details");
    nLog.error(req.body.bulkData);
    nLog.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

exports.getMonthSummary = async function (req, res) {
  const respObj = {
    Message: "Ok",
    IsSuccess: false,
    Data: null,
  };

  try {
    if (!req.body.id) {
      respObj.Message = "Invalid user id.";
      return res.json(respObj);
    }

    const startOfMonth = moment
      .tz(moment.now(), process.env.MOMENT_TZ)
      .startOf("month");
    const endOfMonth = moment
      .tz(moment.now(), process.env.MOMENT_TZ)
      .endOf("month");

    const shortLeavesCount = await Leave.count({
      branch_id: req.body.branch_id,
      staff_id: req.body.id,
      fromDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
      leave_type: "Short",
      isDeleted: false,
    });
    const HalfDayLeavesCount = await Leave.count({
      branch_id: req.body.branch_id,
      staff_id: req.body.id,
      fromDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
      leave_type: "Half day",
      isDeleted: false,
    });

    const allFullDaysInThisMonth = await Leave.find({
      branch_id: req.body.branch_id,
      staff_id: req.body.id,
      fromDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
      toDate: {
        $lte: endOfMonth,
      },
      leave_type: "Full day",
      isDeleted: false,
    });

    // console.log('this month full days count ', allFullDaysInThisMonth.length);

    let fullD = 0;
    allFullDaysInThisMonth.map(async (leaveRecord) => {
      let currentLeaveStreakDays = 0;
      const leaveStartdayMoment = moment
        .tz(moment(leaveRecord.fromDate), process.env.MOMENT_TZ)
        .startOf("day");
      currentLeaveStreakDays = Math.ceil(
        moment
          .duration(
            moment(leaveRecord.toDate).startOf("day").diff(leaveStartdayMoment)
          )
          .asDays()
      );
      fullD += currentLeaveStreakDays;
    });

    const allFullDaysWithSomeDaysInNextMonth = await Leave.find({
      branch_id: req.body.branch_id,
      staff_id: req.body.id,
      fromDate: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
      toDate: {
        $gte: endOfMonth,
      },
      leave_type: "Full day",
      isDeleted: false,
    });

    let fullDays = 0;
    allFullDaysWithSomeDaysInNextMonth.map(async (leaveRecord) => {
      let currentLeaveStreakDays = 0;
      const leaveStartdayMoment = moment
        .tz(moment(leaveRecord.fromDate), process.env.MOMENT_TZ)
        .startOf("day");
      currentLeaveStreakDays = Math.ceil(
        moment
          .duration(endOfMonth.endOf("day").diff(leaveStartdayMoment))
          .asDays()
      );
      fullDays += currentLeaveStreakDays;
    });

    const allFullDaysWithSomeDaysComingFromPrevMonth = await Leave.find({
      branch_id: req.body.branch_id,
      staff_id: req.body.id,
      fromDate: {
        $lt: startOfMonth,
      },
      toDate: {
        $lte: endOfMonth,
      },
      leave_type: "Full day",
      isDeleted: false,
    });

    let fullDaysTypeTwo = 0;

    allFullDaysWithSomeDaysComingFromPrevMonth.map(async (leaveRecord) => {
      let currentLeaveStreakDays = 0;
      const leaveEndDayMoment = moment
        .tz(moment(leaveRecord.toDate), process.env.MOMENT_TZ)
        .endOf("day");
      currentLeaveStreakDays = Math.ceil(
        moment
          .duration(leaveEndDayMoment.diff(startOfMonth.startOf("day")))
          .asDays()
      );
      fullDaysTypeTwo += currentLeaveStreakDays;
    });

    const allVisitsCount = await Visit.count({
      branch_id: req.body.branch_id,
      staff_id: req.body.id,
      punch_date_time: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },

      isDeleted: false,
    });

    const allVisitsDistanceThisMonth = await Attendance.aggregate([
      {
        $match: {
          branch_id: mongoose.Types.ObjectId(req.body.branch_id),
          staff_id: mongoose.Types.ObjectId(req.body.id),
          punch_in_date_time: {
            $gte: new Date(startOfMonth),
            $lte: new Date(endOfMonth),
          },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: "$distanceTravelForTheDay" },
        },
      },
    ]);

    let disTo = 0;
    if (allVisitsDistanceThisMonth && allVisitsDistanceThisMonth.length > 0) {
      disTo = allVisitsDistanceThisMonth[0].count.toFixed(2);
    }
    respObj.Data = {
      LeavesCount:
        shortLeavesCount +
        HalfDayLeavesCount +
        fullDays +
        fullDaysTypeTwo +
        fullD,
      HalfDays: HalfDayLeavesCount,
      ShortLeaves: shortLeavesCount,
      FullDays: fullDays + fullDaysTypeTwo + fullD,
      VisitsCount: allVisitsCount,
      TotalDistanceThisMonth: disTo,
    };
    nLog.debug(
      `Month summary request by staff id "${req.body.id}" of branch "${req.body.branch_id}" handled successfully.`
    );

    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log("error while getting month summary ");
    console.error(ex);

    nLog.error(
      `Month summary request by staff id "${req.body.id}" of branch "${req.body.branch_id}" failed.`
    );
    nLog.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};
exports.tee = async function (req, res) {
  const respObj = {
    Message: "Ok",
    IsSuccess: false,
    Data: null,
  };

  try {
    const re = await commonCtrl.reverseGeocodeGivenLatLng(
      req.query.lat,
      req.query.lon
    );
    respObj.Data = re;
    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    respObj.IsSuccess = false;
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};

// exports.saveRepo = async function (req, res) {
//   const respObj = {
//     Message: 'Ok',
//     IsSuccess: false,
//   };

//   try {
//     if (!req.body.id) {
//       respObj.Message = 'Invalid user id.';
//       return res.json(respObj);
//     }
//     if (!req.body.branch_id) {
//       respObj.Message = 'Invalid or no branch.';
//       return res.json(respObj);
//     }

//     if (!req.body.customerName) {
//       respObj.Message = 'Invalid customer name.';
//       return res.json(respObj);
//     }
//     if (!req.body.loanNum) {
//       respObj.Message = 'Invalid loan number.';
//       return res.json(respObj);
//     }
//     if (!req.body.nearestPoliceStation) {
//       respObj.Message = 'Invalid police station.';
//       return res.json(respObj);
//     }

//     if (!req.body.punchLocationLati) {
//       respObj.Message = 'Punch location cordinates missing.';
//       return res.json(respObj);
//     }

//     if (!req.body.punchLocationLongi) {
//       respObj.Message = 'Punch location cordinates missing.';
//       return res.json(respObj);
//     }
//     if (!req.body.isRCAvailable) {
//       respObj.Message = 'RC availability missing.';
//       return res.json(respObj);
//     }

//     if (req.body.isRCAvailable && (req.body.isRCAvailable == '1' || req.body.isRCAvailable == 1)) {
//       if (!req.files.rc_front) {
//         respObj.Message = 'RC front image missing.';
//         return res.json(respObj);
//       }
//       if (!req.files.rc_back) {
//         respObj.Message = 'RC back image missing.';
//         return res.json(respObj);
//       }
//     }

//     if (!req.files.bike_top) {
//       respObj.Message = 'Vehicle top image missing.';
//       return res.json(respObj);
//     }
//     if (!req.files.bike_front) {
//       respObj.Message = 'Vehicle front image missing.';
//       return res.json(respObj);
//     }
//     if (!req.files.bike_left) {
//       respObj.Message = 'Vehicle left image missing.';
//       return res.json(respObj);
//     }
//     if (!req.files.bike_right) {
//       respObj.Message = 'Vehicle right image missing.';
//       return res.json(respObj);
//     }
//     if (!req.files.bike_back) {
//       respObj.Message = 'Vehicle back image missing.';
//       return res.json(respObj);
//     }

//     // uploading files to s3
//     console.log('uploding first image');
//     const bike_top_result = await uploadFile(req.files.bike_top[0], req.body.branch_id);
//     console.log(bike_top_result);
//     console.log(bike_top_result.Location);
//     await unlinkFile(req.files.bike_top[0].path);

//     console.log('uploding 2 image');
//     const bike_front_result = await uploadFile(req.files.bike_front[0], req.body.branch_id);
//     await unlinkFile(req.files.bike_front[0].path);

//     console.log('uploding 3 image');
//     const bike_left_result = await uploadFile(req.files.bike_left[0], req.body.branch_id);
//     await unlinkFile(req.files.bike_left[0].path);

//     console.log('uploding 4 image');
//     const bike_right_result = await uploadFile(req.files.bike_right[0], req.body.branch_id);
//     await unlinkFile(req.files.bike_right[0].path);

//     console.log('uploding 5 image');
//     const bike_back_result = await uploadFile(req.files.bike_back[0], req.body.branch_id);
//     await unlinkFile(req.files.bike_back[0].path);

//     let rc_front_path = '';
//     let rc_back_path = '';

//     if (req.body.isRCAvailable && (req.body.isRCAvailable == '1' || req.body.isRCAvailable == 1)) {
//       console.log('going to upload rc images');
//       if (req.files.rc_front) {
//         const rc_front_result = await uploadFile(req.files.rc_front[0], req.body.branch_id);
//         await unlinkFile(req.files.rc_front[0].path);
//         rc_front_path = rc_front_result.Location;
//       }
//       if (req.files.rc_back) {
//         const rc_back_result = await uploadFile(req.files.rc_back[0], req.body.branch_id);
//         await unlinkFile(req.files.rc_back[0].path);
//         rc_back_path = rc_back_result.Location;
//       }
//     }

//     console.log('finally saving..');

//     const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
//     const punch_in_date_string = moment(punchInDateTime).format('DD-MM-YYYY');
//     const punch_in_time_string = moment(punchInDateTime).format('hh:mm A');

//     const locAddress = await commonCtrl.reverseGeocodeGivenLatLng(req.body.punchLocationLati, req.body.punchLocationLongi);

//     const newRepo = new Repo({

//       punch_date_time: punchInDateTime,
//       punch_date_string: punch_in_date_string,
//       punch_time_string: punch_in_time_string,

//       punch_inLocationCoordinates:
//         [req.body.punchLocationLongi,
//           req.body.punchLocationLati],

//       branch_id: req.body.branch_id,
//       staff_id: req.body.id,

//       nearestPoliceStation: req.body.nearestPoliceStation,

//       locationAddress: locAddress,

//       loanNo: req.body.loanNum,
//       partyName: req.body.customerName,

//       isRCAvailable: req.body.isRCAvailable,

//       rcFrontImagePath: rc_front_path,
//       rcBackImagePath: rc_back_path,

//       bikeBackImagePath: bike_back_result.Location,
//       bikeFrontImagePath: bike_front_result.Location,
//       bikeTopImagePath: bike_top_result.Location,
//       bikeLeftImagePath: bike_left_result.Location,
//       bikeRightImagePath: bike_right_result.Location,

//     });

//     await newRepo.save();
//     // nLog.debug(`Apply leave by "${req.body.id}" from branch id "${req.body.branch_id}" and leave type ${req.body.leaveType} successful`)

//     respObj.IsSuccess = true;
//     return res.json(respObj);
//   } catch (ex) {
//     console.log('error while saving leave ');
//     console.error(ex);

//     nLog.error(`Apply leave by "${req.body.id}" from branch id "${req.body.branch_id}" and leave type ${req.body.leaveType} failed`);
//     nLog.error(ex);

//     respObj.IsSuccess = false;
//     respObj.Message = 'Server Error.';
//     return res.json(respObj);
//   }
// };

exports.saveRepo = async function (req, res) {
  console.log("here");
  const respObj = {
    Message: "Ok",
    IsSuccess: false,
  };

  try {
    if (!req.body.staffIds.length == 0) {
      respObj.Message = "Please select atleast 1 Staff.";
      return res.json(respObj);
    }

    if (!req.body.customerName) {
      respObj.Message = "Invalid customer name.";
      return res.json(respObj);
    }
    if (!req.body.loanNum) {
      respObj.Message = "Invalid loan number.";
      return res.json(respObj);
    }
    if (!req.body.nearestPoliceStation) {
      respObj.Message = "Invalid police station.";
      return res.json(respObj);
    }

    if (!req.body.punchLocationLati) {
      respObj.Message = "Punch location cordinates missing.";
      return res.json(respObj);
    }

    if (!req.body.punchLocationLongi) {
      respObj.Message = "Punch location cordinates missing.";
      return res.json(respObj);
    }

    console.log("finally saving..");

    const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
    const punch_in_date_string = moment(punchInDateTime).format("DD-MM-YYYY");
    const punch_in_time_string = moment(punchInDateTime).format("hh:mm A");

    const locAddress = await commonCtrl.reverseGeocodeGivenLatLng(
      req.body.punchLocationLati,
      req.body.punchLocationLongi
    );

    const newRepo = new Repo({
      punch_date_time: punchInDateTime,
      punch_date_string: punch_in_date_string,
      punch_time_string: punch_in_time_string,
      punch_inLocationCoordinates: [
        req.body.punchLocationLongi,
        req.body.punchLocationLati,
      ],

      branch_id: req.body.branch_id,
      staff_id: req.body.staffIds,
      nearestPoliceStation: req.body.nearestPoliceStation,
      locationAddress: locAddress,
      loanNo: req.body.loanNum,
      partyName: req.body.customerName,
    });

    await newRepo.save();
    // nLog.debug(`Apply leave by "${req.body.id}" from branch id "${req.body.branch_id}" and leave type ${req.body.leaveType} successful`)

    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log("error while saving leave ");
    console.error(ex);

    nLog.error(
      `Apply leave by "${req.body.id}" from branch id "${req.body.branch_id}" and leave type ${req.body.leaveType} failed`
    );
    nLog.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = "Server Error.";
    return res.json(respObj);
  }
};
