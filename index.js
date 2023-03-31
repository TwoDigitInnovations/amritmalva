// third parties
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const exphbs = require('express-handlebars');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const nLog = require('noogger');

// logger configurations
const nlogParams = {
  consoleOutput: true,
  consoleOutputLevel: 'DEBUG',
  dateTimeFormat: 'DD-MM-YYYY HH:mm:ss',
  fileNameDateFormat: 'YYYY-MM-DD',
  fileNamePrefix: 'amg-api-',
  outputPath: 'logs/',
};
nLog.init(nlogParams);

// Init App
const app = express();

app.set('trust proxy', true);

const server = http.createServer(app);

// connect to db
mongoose.connect(
  process.env.MONGO_DB_CONN_STRING,
  { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false },
  (err) => {
    if (err) console.log(err);
    else { console.log('connected..'); nLog.info('DB Connected..'); }
  },
);

// Use CORS
app.use(cors());

// Use body-parser to get POST requests for API use
app.use(
  bodyParser.json({
    limit: '50mb',
  }),
);

app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Bring in defined Passport Strategy
require('./config/passport')(passport);
// Initialize passport for use
app.use(passport.initialize());
app.use(passport.session());

// Custom dependencies
// Routes setup
const routes = require('./routes/index');
const apiRoutes = require('./routes/api');

app.use('/api', apiRoutes);
app.use('/', routes);

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.engine(
  'handlebars',
  exphbs({
    defaultLayout: 'layout',
  }),
);
app.set('view engine', 'handlebars');

// Set Port
app.set('port', process.env.PORT || 80);
server.listen(app.get('port'), () => {
  console.log(`Server started on port ${app.get('port')}`);
  nLog.info(`Server started on port ${app.get('port')}`);
});
