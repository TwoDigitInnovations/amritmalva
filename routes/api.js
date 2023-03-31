const express = require('express');

const router = express.Router();
const passport = require('passport');

const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

const staffCtrl = require('../controllers/staffCtrl');
const commonCtrl = require('../controllers/commonCtrl');
const messagesCtrl = require('../controllers/messagesCtrl');

// Get Homepage
router.get('/', (req, res) => {
  res.json({
    API: '1.0',
  });
});

// open - no auth
router.post('/login', staffCtrl.login);
router.get('/te', staffCtrl.tee);
router.post('/logout', staffCtrl.logout);
// eslint-disable-next-line max-len
// router.put("/user/:id/logout",passport.authenticate(["jwt"], {session: false}), _userCtrl.logout);
router.post('/user/profile', passport.authenticate(['jwt'], { session: false }), staffCtrl.getMyProfile);
router.post('/user/messages', passport.authenticate(['jwt'], { session: false }), messagesCtrl.getMyMessages);
router.post('/user/files', passport.authenticate(['jwt'], { session: false }), messagesCtrl.getMyFiles);
// router.get("/user/location", commonCtrl.distanceBetweenTwoPoints());
router.post('/attendance', passport.authenticate(['jwt'], { session: false }), staffCtrl.markAttendance);
router.post('/summary', passport.authenticate(['jwt'], { session: false }), staffCtrl.getMonthSummary);
router.post('/visit', passport.authenticate(['jwt'], { session: false }), staffCtrl.markVisit);
router.post('/visitBulk', passport.authenticate(['jwt'], { session: false }), staffCtrl.markVisitBulk);
router.post('/applyLeave', passport.authenticate(['jwt'], { session: false }), staffCtrl.applyLeave);
router.get('/pushTest', commonCtrl.pushTest);
router.post('/pushLocation', commonCtrl.pushLocation);
const cpUpload = upload.fields([{ name: 'rc_front', maxCount: 1 }, { name: 'rc_back', maxCount: 1 }, { name: 'bike_top', maxCount: 1 }, { name: 'bike_front', maxCount: 1 }, { name: 'bike_left', maxCount: 1 }, { name: 'bike_right', maxCount: 1 }, { name: 'bike_back', maxCount: 1 }]);
//router.post('/repo', passport.authenticate(['jwt'], { session: false }), cpUpload, staffCtrl.saveRepo);
router.post('/repo', cpUpload, staffCtrl.saveRepo);


module.exports = router;
