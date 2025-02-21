const mongoose = require('mongoose');

const User = mongoose.model('UserInfo', new mongoose.Schema({
    UserID: { type: String, required: false, },
    fName: { type: String, Required: true, },
    lName: { type: String, Required: true, },
    GraduationSemester: { type: String, Required: false, },
    GraduationYear: {type: String, Required: false,},
    Email: { type: String, required: true, },
    Role: { type: String, required: true, },
    GolfCart: { type: String, required: false, },
}));
module.exports = User;
