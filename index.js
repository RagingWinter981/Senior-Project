const express = require("express");
const mongoose = require("mongoose");
const app = express();
const PORT = 3000;
const moment = require('moment');
const session = require('express-session');
const bcrypt = require('bcrypt')
const nodemailer = require("nodemailer");
const { userInfoMiddleware } = require('./utils/headerInitials');

app.use(userInfoMiddleware)

app.use(session({
  secret: 'test-secret-key',  // Change this to a secure key
  resave: true,
  saveUninitialized: false,
  name: 'manfra.io',
  // cookie:{
  //   maxAge: 10000
  // }
}));

// Define the EventInfo schema
const eventSchema = new mongoose.Schema({
  EventName: { type: String, required: true }
});

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Use the model only if it hasn't been defined yet
const Event = mongoose.models.EventInfo || mongoose.model('EventInfo', eventSchema, 'EventInfo');

app.use(userInfoMiddleware)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/images', express.static('images'));
app.locals.moment = moment; 

// Connect to PAApp database
const uri = "mongodb+srv://ksmith30:A11Th3Stars@seniorproject.brwao.mongodb.net/PAApp?retryWrites=true&w=majority&appName=SeniorProject";
mongoose.connect(uri)
  .then(() => {
    console.log('Connected to the db');
    
    // Fetch data from EventInfo collection in PAApp
    async function fetchEvents() {
      try {
        const data = await Event.find({});
        //console.log('Data retrieved: ', data);  // Logs the data retrieved from EventInfo collection
      } catch (err) {
        console.error('Error fetching data: ', err);
      }
    }

    // Call the async function to fetch events
    fetchEvents();
  })
  .catch(err => {
    console.error('Error connecting to the database: ', err);
  });

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set("view engine", "ejs");

app.use("", require("./routes/routes"));

app.listen(3000, () => {
  console.log(`Server Started at http://localhost:${PORT}/events`);
});
