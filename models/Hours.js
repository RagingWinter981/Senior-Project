const mongoose = require('mongoose');

const Event = mongoose.model('Hours', new mongoose.Schema({
  UserID: { type: String, required: true, },
  EventID: { type: String, required: true, },
  HoursEarned: {type: Number, Required: true,},
  RequestedTime: {type: Number, Required: false,},
  Reasoning: {type: String, Required: false,},
  Approval: {type: String, required: false,}

}));
module.exports = Event;
