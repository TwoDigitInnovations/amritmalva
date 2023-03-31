/* eslint-disable prefer-regex-literals */
/* eslint-disable max-len */
/* eslint-disable no-undef */
/* eslint-disable camelcase */
/* eslint-disable no-multi-assign */
/* eslint-disable func-names */
/* eslint-disable no-unused-vars */
// third parties
const admin = require('firebase-admin');
const { Client } = require('@googlemaps/google-maps-services-js');
const axios = require('axios');
const nLog = require('noogger');
const haversine = require('haversine-distance');

const _ = require('lodash');
const moment = require('moment');
const serviceAccount = require('../config/am-capital-6ba50-firebase-adminsdk-tge8u-272bf736c0.json');

// models
const Admin = require('../models/Admin');
const Staff = require('../models/Staff');
const Branch = require('../models/Branch');

const defaultApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const getAdminById = (exports.getAdminById = async function (
  id,
  andCondition = {},
) {
  const existingUser = await Admin.findOne({
    $and: [{ _id: id }, andCondition],
  });
  return existingUser;
});

exports.seedAdmin = async function () {
  const newAdmin = new Admin({
    firstName: 'Malkit',
    lastName: 'Singh',
    email: 'malkitsingh01@gmail.com',
  });
  newAdmin.save();
};
exports.addBranch = async function (stateName, newBranch, created_By) {
  const res = {
    Message: 'Ok',
    IsSuccess: true,
  };

  const existingBranch = await Branch.findOne({
    name: newBranch,
    state: stateName,
    status: 'Active',
  });

  if (existingBranch != null) {
    res.Message = 'Given branch name already exists in given state';
    res.IsSuccess = false;
    return res;
  }

  const newBranchs = new Branch({
    name: newBranch,
    state: stateName,
    created_By,
    modified_By: created_By,
  });
  newBranchs.save();
  return res;
};
exports.delBranch = async function (branchId, created_By) {
  const res = {
    Message: 'Ok',
    IsSuccess: true,
  };

  const existingBranch = await Branch.findOne({
    _id: branchId,
    status: 'Active',
  });

  if (existingBranch == null) {
    res.Message = 'Given branch already deleted or not valid.';
    res.IsSuccess = false;
    return res;
  }

  const newBranchs = await Branch.findOneAndUpdate({
    _id: branchId,
  }, {
    status: 'Deleted',
    modified_By: created_By,
  });

  return res;
};

exports.reverseGeocodeGivenLatLng = async function (lat, lng) {
  try {
    let ress = '';
    if (process.env.IS_NOMINATIM === '1') {
      ress = await reverseGeocodeGivenLatLngUsingNominatim(lat, lng);
      if (ress === '' || ress === undefined) {
        ress = await reverseGeocodeGivenLatLngUsingGoogle(lat, lng);
      }
    } else {
      ress = await reverseGeocodeGivenLatLngUsingGoogle(lat, lng);
    }
    return ress;
  } catch (ex) {
    nLog.error(`Error in reverse geocoding lati "${lat}" and longi "${lng}"`);
    if (lat === undefined || lng === undefined) {
      return 'Error';
    }
    const newRess = await reverseGeocodeGivenLatLngUsingGoogle(lat, lng);
    return newRess;
  }
};
reverseGeocodeGivenLatLngUsingGoogle = async function (lat, lng) {
  try {
    const client = new Client({});
    const resultOfRGc = await client.reverseGeocode({
      params: {
        key: process.env.MAPS_KEY,
        latlng: `${lat},${lng}`,
      },
      timeout: 1000, // milliseconds
    });
    nLog.debug(`Reverse geocode result for lati "${lat}" and longi "${lng}" is "${resultOfRGc?.data?.results[0]?.formatted_address}"`);
    return resultOfRGc?.data?.results[0]?.formatted_address || '';
  } catch (ex) {
    console.log('Unable to reverse geocode following ');
    console.log('Latituide  ', lat, ' and Longitude ', lng);
    console.log(ex);
    nLog.error(`Reverse geocode for lati "${lat}" and longi "${lng}" failed`);
    nLog.error(ex);
    return 'Error';
  }
};

reverseGeocodeGivenLatLngUsingNominatim = async function (lat, lng) {
  try {
    let revRes = '';
    const reverseResult = await axios.get(`${process.env.NOMINATIM_REVERSE_URL}lat=${lat}&lon=${lng}&format=json`);
    if (reverseResult.status === 200) {
      revRes = reverseResult?.data?.display_name;
      nLog.debug(`Reverse geocode result (Nominatim) for lati "${lat}" and longi "${lng}" is "${reverseResult?.data?.display_name}"`);
    }
    return revRes;
  } catch (ex) {
    console.log('Unable to reverse geocode following using Nominatim');
    console.log('Latituide  ', lat, ' and Longitude ', lng);
    console.log(ex);
    nLog.error(`Reverse geocode using Nominatim for lati "${lat}" and longi "${lng}" failed`);
    nLog.error(ex);
    return 'Error';
  }
};
exports.distanceBetweenTwoPoints = async function (originLat, originLng, destinationLat, destinationLng) {
  try {
    const distanceResult = await axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json?destinations=${destinationLat},${destinationLng}&origins=${originLat},${originLng}&key=${process.env.MAPS_KEY}`);
    // console.log('distance result ');
    // console.log(distanceResult);
    let distanceInKm = 0;
    if (distanceResult.data.status === 'OK') {
      distanceInKm = distanceResult.data.rows[0].elements[0].distance.value / 1000;
    }
    console.log('distance is ', distanceInKm);
    nLog.debug(`Distance b/w orig.lati "${originLat}", orig.longi "${originLng}" and desti.lati "${destinationLat}", desti.longi "${destinationLng}" is "${distanceInKm}"`);
    const myCalculatedDistance = haversine({ latitude: originLat, longitude: originLng }, { latitude: destinationLat, longitude: destinationLng }) / 1000;
    nLog.debug(`haversine-distance Distance b/w orig.lati "${originLat}", orig.longi "${originLng}" and desti.lati "${destinationLat}", desti.longi "${destinationLng}" is "${myCalculatedDistance}"`);
    return distanceInKm;
  } catch (ex) {
    console.log('Unable to get distance between following points ');
    console.log('Origin Latituide  ', originLat, ', Origin Longitude ', originLng, ' Destination Latituide  ', destinationLat, ', Destination Longitude ', destinationLng);
    console.log(ex);
    nLog.error(`Distance calculation b/w orig.lati "${originLat}", orig.longi "${originLng}" and desti.lati "${destinationLat}", desti.longi "${destinationLng}" failed`);
    nLog.error(ex);
    return 0;
  }
};
const isValidMongoId = (exports.isValidMongoId = function (id) {
  const checkForHexRegExp = new RegExp('^[0-9a-fA-F]{24}$');
  return checkForHexRegExp.test(id);
});

exports.pushTest = async function (req, res) {
  const respObj = {
    Message: 'Ok',
    IsSuccess: false,
  };

  try {
    const registrationToken = 'emDTrrxhT06B4vtXGg0CA2:APA91bEQ5bM9jAhYheQkMQ5xrXE_0zqXIF40k1JKvTF-Peb4QSffRLkM0bAQrH3QlxIMqnGLJKg-_HCEqxRR4L1SemLd8kphbaJzWwWPLpbBCxcGKxcVoYVmKUnSh52HKYAG26vtePUH';

    const message = {
      data: {
        score: '850',
        time: '2:45',
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
          'apns-topic': 'com.amritmalwa', // your app bundle identifier
        },
      },
      token: registrationToken,
      android: {
        priority: 'high',
      },
    };

    admin.messaging().send(message)
      .then((response) => {
        // Response is a message ID string.
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });
    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log('error while saving visit ');
    console.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = 'Server Error.';
    return res.json(respObj);
  }
};

exports.pushLocation = async function (req, res) {
  const respObj = {
    Message: 'Ok',
    IsSuccess: false,
  };

  try {
    console.log('Location pushed by some remote user...');
    console.log('userId');
    console.log(req.body.userId);
    console.log('lati');
    console.log(req.body.lati);
    console.log('longi');
    console.log(req.body.longi);

    if (req.body.userId && req.body.lati && req.body.longi) {
      const punchInDateTime = moment.tz(moment.now(), process.env.MOMENT_TZ);
      const punch_in_date_string = moment(punchInDateTime).format('DD-MM-YYYY');
      const punch_in_time_string = moment(punchInDateTime).format('hh:mm A');

      const addressParsed = await reverseGeocodeGivenLatLngUsingGoogle(req.body.lati, req.body.longi);
      const existingUserByEmail = await Staff
        .findOneAndUpdate({
          fcmToken: req.body.userId,
        }, {
          liveLocationAddress: addressParsed,
          liveLocationDateTimeString: `${punch_in_date_string} ${punch_in_time_string}`,
        });
    }

    respObj.IsSuccess = true;
    return res.json(respObj);
  } catch (ex) {
    console.log('error while reading remote location');
    console.error(ex);

    respObj.IsSuccess = false;
    respObj.Message = 'Server Error.';
    return res.json(respObj);
  }
};
