const mongoose = require('mongoose');

const Request = mongoose.model('RequestInfo', new mongoose.Schema({
  //Event Details
  EventName: { type: String, required: true, },
  Location: { type: String, required: true, },
  DateStart: { type: Date, Required: true, },
  DateEnd: { type: Date, Required: true, },
  ReportTime: { type: Date, Required: true, },
  
  //POC Info
  pocName: { type: String, required: true, },
  pocOffice: { type: String, required: true }, 
  pocTitle: { type: String, required: true },
  pocEmail: { type: String, required: true },

  //Details
  attire: { type: String, required: true, },
  numSpots:{type: Number, Required: true,},
  requestDescription: { type: String, required: true, },
  additionalNotes: { type: String, required: false, },

  //Accept/Reject
  IsEvent: { type: String, required: false, },
  Reasoning: { type: String, required: false, },
}));
module.exports = Request;

