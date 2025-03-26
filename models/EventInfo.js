const mongoose = require('mongoose');

const Event = mongoose.model('Eventinfo', new mongoose.Schema({
  EventName: { type: String, required: true, },
  DateStart: { type: Date, Required: true, },
  DateEnd: { type: Date, Required: true, },
  DateReportTime: { type: Date, Required: true, },
  AdjustedTime: {type: Number, Required: true,},
  LiveTime: { type: Date, Required: true, },
  NumOfHours: { type: Number, required: true, },
  Location: { type: String, required: true, },
  Attire: { type: String, required: true, },
  PACoordinatorName: { type: String, required: true, },
  PACoordinatorOffice: { type: String, required: true }, 
  PACoordinatorTitle: { type: String, required: true }, 
  NumOfPAs:{type: Number, Required: true,},
  Description: { type: String, required: true, },
  Roles: { type: Array, required: false,}

}));
module.exports = Event;

