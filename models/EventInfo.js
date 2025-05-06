const mongoose = require('mongoose');

const Event = mongoose.model('Eventinfo', new mongoose.Schema({
  EventName: { type: String, required: true },
  DateStart: { type: Date, required: true },
  DateEnd: { type: Date, required: true },
  DateReportTime: { type: Date, required: true },
  AdjustedTime: { type: Number, required: true },
  LiveTime: { type: Date, required: true },
  NumOfHours: { type: Number, required: true },
  Location: { type: String, required: true },
  Attire: { type: String, required: true },
  PACoordinatorName: { type: String, required: true },
  PACoordinatorOffice: { type: String, required: true }, 
  PACoordinatorTitle: { type: String, required: true }, 
  NumOfPAs: { type: Number, required: true },
  Description: { type: String, required: true },
  Roles: {
    golfCartDriver: { type: Number, required: false },
    leadPA: { type: Number, required: false },
    senior: { type: Number, required: false },
    junior: { type: Number, required: false },
    sophomore: { type: Number, required: false },
  },
  BackUp: { type: Number, required: false }
}));

module.exports = Event;

