const express = require('express');
const mongoose = require("mongoose");
const router = express.Router();
const Event = require('../models/EventInfo');
const UserInfo = require('../models/UserInfo');
const LogIn = require('../models/LogIn');
const Hours = require('../models/Hours');
const Request = require('../models/RequestInfo');
const bcrypt = require('bcrypt');
const { adminCheckLoggedIn,paCheckLoggedIn, bypassLogin, adminOrPACheckLoggedIn } = require('../utils/functions');
const crypto = require("crypto");
const transporter = require('../utils/mailer');

/********************** */
// Guest Pages
/*********************** */
router.get("/RequestAnEvent", (req, res) => {
    res.render('GuestRequestEvents');
})

router.post("/RequestAnEvent", async(req, res) => {
    console.log("Request Body:", req.body); // Ensure this logs the expected data
    try {
        const event = new Request({
            // Event Description
            EventName: req.body.EventName,
            Location:  req.body.Location,
            DateStart: new Date(req.body.DateStart),
            DateEnd: new Date(req.body.DateEnd),
            ReportTime: new Date(req.body.ReportTime),
            
            // Point of Contact Info
            pocName: req.body.pocName,
            pocOffice: req.body.pocOffice,
            pocTitle: req.body.pocTitle,
            pocEmail: req.body.pocEmail, 

            // Other details
            attire: req.body.attire,
            numSpots: parseInt(req.body.numSpots),
            requestDescription: req.body.requestDescription,
            additionalNotes: req.body.additionalNotes,

        });
        await event.save();
        console.log("Event saved:", event.toObject()); // Log event to ensure it's saved
        res.redirect('/RequestAnEvent');
    } catch (err) {
        console.log("Error:", err);
        res.json({ message: err.message, Type: 'danger' });
    }
})



/*********************** */
// Admin Pages
/*********************** */

router.get("/",adminCheckLoggedIn, (req, res) => {
    console.log('User initials:', res.locals.userInitals);
    res.redirect('AdminHome');
})

router.get("/Login",bypassLogin, async (req, res) => {
    res.render('index');
})

router.get("/forgotPassword", async (req, res) => {
    res.render("forgotPassword");
})

router.post("/ForgotPassword", async (req, res) => {
    try{
        const Email = req.body.email

        const user = await LogIn.findOne({
            UserName: Email
        })
        if(!user){
            //Modal box
            res.redirect("forgotPassword");
        }
        //Generate Random 6 digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        user.PasswordResetToken = code;
        user.PasswordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Email the code
        const mailOptions = {
            from: "quixy4101@gmail.com",
            to: Email,
            subject: "PA Password Reset Code",
            text: `Please use this 6-digit code to reset your password: ${code}\n\nIf this wasn't you, please contact your administrator.`,
        };

        await transporter.sendMail(mailOptions);

        res.redirect(`/enterCode?email=${encodeURIComponent(Email)}`);
    }
    catch(err){
        console.log("Problem with Forgot Password: ", err)
    }
})
router.get("/enterCode", async (req, res) => {
    const email = req.query.email;
    res.render("ForgotNewPassword", { email });
});
router.post("/verify-reset-code", async (req, res) => {
    try {
        const { email, code, password } = req.body;

        // Find the user by email
        const user = await LogIn.findOne({ UserName: email });

        if (!user) {
            return res.status(400).send("User not found.");
        }

        // Check if the reset token exists and is not expired
        if (!user.PasswordResetToken || user.PasswordResetExpires < Date.now()) {
            return res.status(400).send("Reset token has expired or is invalid.");
        }

        // Verify the reset code
        if (user.PasswordResetToken !== code) {
            return res.status(400).send("Invalid reset code.");
        }

        const salt = await bcrypt.genSalt(10); // Generate salt
        const hashedPassword = await bcrypt.hash(password, salt); // Hash the password

        // Update the password and clear reset token/expiration fields
        user.Password = hashedPassword;
        user.PasswordResetToken = undefined; // Clear the reset token after it’s used
        user.PasswordResetExpires = undefined; // Clear the expiration time
        await user.save();

        // You could send a success message or redirect to a login page
        res.redirect("/login"); // Redirecting to login page for example
    } catch (err) {
        console.log("Error with reset password:", err);
        res.status(500).send("Server error.");
    }

})
router.get("/changePassword", adminOrPACheckLoggedIn, async (req, res) => {
    res.render("changePassword")
})

router.post("/changePassword", adminOrPACheckLoggedIn, async (req, res) => {
    try {
      const userId = req.session.user.id;
      const currentPass = req.body.currentPassword;
      const newPass = req.body.password;
  
      const user = await LogIn.findById(userId);
      if (!user) return res.render("changePassword", { errorType: "incorrect" });
  
      const match = await bcrypt.compare(currentPass, user.Password);
      if (!match) return res.render("changePassword", { errorType: "incorrect" });
  
      const hashedNewPass = await bcrypt.hash(newPass, 10);
      await LogIn.findByIdAndUpdate(userId, { Password: hashedNewPass });
  
      // Destroy session after password change for security
      req.session.destroy(err => {
        if (err) {
          console.error("Session destruction failed:", err);
          return res.render("changePassword", { errorType: "success" }); // fallback
        }
  
        // Show success modal, then redirect from frontend
        res.render("changePassword", { errorType: "success" });
      });
  
    } catch (err) {
      console.error("Password update error:", err);
      res.status(500).send("Server error");
    }
  });
  


router.post("/Login", async (req, res) => {
    try{
        const check = await LogIn.findOne({UserName: req.body.UserName,});
        const checktype =  await UserInfo.findOne({Email: req.body.UserName,});
        if (!check){
            res.send("Username cannot be found")
        }
        const isPwMatch= await bcrypt.compare(req.body.Password, check.Password);
        if(isPwMatch){
            req.session.user = {id: check._id, username: check.UserName, type: checktype.Role} 
        if (req.session.user.type == 'Admin'){
            res.redirect("/adminHome")}
        else if(req.session.user.type == 'President Ambassador'){
            res.redirect("/PAHome") }   
        }else{
            res.redirect("/Login")
        }
    }catch(err){
        console.log("Error at Login: ", err)
        res.redirect("/Login")
    }
})

router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('manfra.io')
        res.redirect("/Login");
    });
  });


// GET route to display the password reset form
router.get("/create-password/:token", async (req, res) => {
    const token = req.params.token;
    const user = await LogIn.findOne({
        PasswordResetToken: token,
        PasswordResetExpires: { $gt: Date.now() } // Token still valid
    });
  
    if (!user) {
        console.log("user tried token: ", token)
        return res.send("Token is invalid or has expired.");
    }
    res.render("createPassword", { token }); // Render the form and pass the token along
});
  
// POST route to handle the password reset
router.post("/create-password", async (req, res) => {
    const { password, token } = req.body;

    // Make sure the password is not empty or invalid
    if (!password || password.length < 6) {
        return res.send("Password must be at least 6 characters.");
    }

    const user = await LogIn.findOne({
        PasswordResetToken: token,
        PasswordResetExpires: { $gt: Date.now() } // Token still valid
    });
  
    if (!user) {
        return res.send("Token is invalid or has expired.");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.Password = hashedPassword;
    user.PasswordResetToken = undefined;  // Remove the reset token after use
    user.PasswordResetExpires = undefined; // Expiration date should also be removed
    await user.save();
  
    // Redirect to login page or render a success message
    res.redirect('/login'); // Or render a success message if you prefer
});



//Admin Home Page
router.get("/adminHome",adminCheckLoggedIn, async(req, res) => {
    try{
        const hoursData = await Hours.find();
        const eventData = await Event.find().sort({DateReportTime: 1});

        const numofRequest = await Request.countDocuments({
            $or: [
                { IsEvent: { $exists: false } },   // Undefined
                { IsEvent: null }                  // Null
            ]
        });
        

        // Define eventIds based on hoursData
        const eventIds = hoursData.map(hour => hour.EventID);

        // Calculate Approvals and numofRequest
        const Approvals = hoursData
            .filter(hour => eventIds.includes(hour.EventID.toString()) && hour.Approval === "Waiting for Approval")
            .length;

        //Number of live events
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();   // 💡 Define this here
        const currentYear = currentDate.getFullYear(); // 💡 And this too

       // const currentDate = new Date();
        const futureEvents = eventData.filter(event => {
            const eventDate = new Date(event.DateReportTime);
            return (
                eventDate > currentDate && 
                eventDate.getMonth() === currentMonth && 
                eventDate.getFullYear() === currentYear
            );
        });

        const LiveEvents = await Event.countDocuments({
            $and: [
                { LiveTime: { $lte: currentDate } },
                { DateEnd: { $gte: currentDate}}  ]
        });

        // Render the page with data
        res.render("AdminHome", { Approvals, numofRequest, LiveEvents,futureEvents });
    }catch(err){}
})

//Fetching Create events Page
router.get("/events",adminCheckLoggedIn, (req, res) => {
    res.render("CreateEvent");
})



//Admin Create Events Page with Create Function
router.post("/events", adminCheckLoggedIn, async (req, res) => {
    try {
        console.log("req.body:", req.body);
      const event = new Event({
        EventName: req.body.EventName,
        DateReportTime: new Date(req.body.DateReportTime),
        DateStart: new Date(req.body.DateStart),
        DateEnd: new Date(req.body.DateEnd),
        LiveTime: new Date(req.body.LiveTime),
        AdjustedTime: parseFloat(req.body.AdjustedTime),
        Location: req.body.Location,
        NumOfHours: parseFloat(req.body.NumOfHours),
        Attire: req.body.Attire,
        PACoordinatorName: req.body.PACoordinatorName,
        PACoordinatorOffice: req.body.PACoordinatorOffice,
        PACoordinatorTitle: req.body.PACoordinatorTitle,
        NumOfPAs: parseInt(req.body.NumOfPAs),
        Description: req.body.Description,
        Roles: {
          golfCartDriver: parseInt(req.body.Roles['golfCartDriver']) || 0,
          leadPA: parseInt(req.body.Roles['leadPA']) || 0,
          senior: parseInt(req.body.Roles['senior']) || 0,
          junior: parseInt(req.body.Roles['junior']) || 0,
          sophomore: parseInt(req.body.Roles['Sophomore']) || 0
        },
        BackUp: parseInt(req.body.BackUp) || 0
      });
  
      await event.save();
      console.log("Event saved:", event.toObject());
      res.redirect('/adminHome');
    } catch (err) {
      console.log("Error:", err);
      res.json({ message: err.message, Type: 'danger' });
    }
  });
  
//Fetching Search Events Page
router.get("/allEvents",adminCheckLoggedIn, async (req, res) => {
    try {
        const events = await Event.find().sort({ DateReportTime: 1 }); // Fetch data from the database
    
        const eventSignupCounts = {};

        for (const event of events) {
            const count = await Hours.countDocuments({ EventID: event._id });
            eventSignupCounts[event._id] = count;
        }
        res.render("AdminSearchEvent", { events, eventSignupCounts });
    } catch (err) {
        console.log("Error with getting AdminSearchEvents: ",err)
        redirect("/adminHome")
    }
});

router.post("/search", adminCheckLoggedIn, async (req, res) => {
    try {
        let eventName = req.body.searchEventName;
        let availability = req.body.searchSpots; // "Available", "Full", or "" for all
        let date = req.body.date;

        let query = {
            EventName: { $regex: new RegExp(eventName, "i") }
        };
        
        if (date) {
            // Convert to date object and match date only (ignoring time)
            const selectedDate = new Date(date);
            
            // Create date range for the selected day
            const nextDate = new Date(selectedDate);
            nextDate.setDate(selectedDate.getDate() + 1);
        
            query.DateReportTime = {
                $gte: selectedDate,
                $lt: nextDate
            };
        }
        
        const events = await Event.find(query).sort({ DateReportTime: 1 });

        let eventSignupCounts = {};
        let filteredEvents = [];

        for (const event of events) {
            const count = await Hours.countDocuments({ EventID: event._id });
            eventSignupCounts[event._id] = count;

            const isFull = count >= event.NumOfPAs;
            const isAvailable = count < event.NumOfPAs;

            if (
                availability === "full" && isFull ||
                availability === "available" && isAvailable ||
                availability === "" || !availability // no filter, include all
            ) {
                filteredEvents.push(event);
            }
        }

        res.render("AdminSearchEvent", { events: filteredEvents, eventSignupCounts });

    } catch (err) {
        console.log("Error with posting Search: ", err);
        res.redirect("/allEvents");
    }
});

//
router.get("/view/:id", adminCheckLoggedIn, async (req, res) => {
    let id = req.params.id;
    try {
        const event = await Event.findById(id);

        if (!event) {
            return res.redirect('/');
        }

        // Retrieve all hours associated with the event
        const eventData = await Hours.find({ EventID: event._id });

        // Extract all UserID values
        const userIds = eventData.map(data => data.UserID);

        // Find all associated emails
        const userEmails = await LogIn.find({ _id: { $in: userIds } });
        

        // Extract the email addresses
        const emails = userEmails.map(user => user.UserName);

        // Find all users with the matching emails
        const userNames = await UserInfo.find({ Email: { $in: emails } });
        const allusers = await UserInfo.find({
            Role: 'President Ambassador',
            Email: { $nin: emails }
        });
        res.render('AdminViewEvent', { event, userNames, allusers });

    } catch (err) {
        console.error('Error:', err);
        res.redirect('/');
    }
});

//
router.post("/SwitchShift", adminCheckLoggedIn, async (req, res) => {
    const { hourId, NewPa, OldPa } = req.body;
    
    try {
        // Find the emails of both Old and New PA
        const oldPaUser = await UserInfo.findById(OldPa);
        const newPaUser = await UserInfo.findById(NewPa);
        
        if (!oldPaUser || !newPaUser) {
            return res.status(400).send("Invalid User IDs.");
        }

        const oldPaLogin = await LogIn.findOne({ UserName: oldPaUser.Email });
        const newPaLogin = await LogIn.findOne({ UserName: newPaUser.Email });

        if (!oldPaLogin || !newPaLogin) {
            return res.status(400).send("User login not found.");
        }

        // Update the Hours collection to switch the shift
        const printUpdate = await Hours.findOne( { EventID: hourId, UserID: oldPaLogin._id })
        const updatedHour = await Hours.findOneAndUpdate(
            { EventID: hourId, UserID: oldPaLogin._id },  // Find the existing hour record
            { UserID: newPaLogin._id },                   // Replace with new PA ID
            { new: true }
        );

        if (!updatedHour) {
            console.log("Event id: ", hourId, "User id: ",oldPaLogin._id )
            console.log(printUpdate)
            return res.status(400).send("Shift switch failed.");
        }

        res.redirect(`/view/${hourId}`);
    } catch (err) {
        console.error("Error switching shift:", err);
        res.status(500).send("Internal Server Error.");
    }
});

//Request Approval page
router.get("/RequestEvents",adminCheckLoggedIn, async (req, res) => {
    try {
        const requests = await Request.find({ IsEvent: { $exists: false } }).sort({ReportTime: 1});

        // Use MongoDB's $or operator
        const handledrequests = await Request.find({
            $or: [{ IsEvent: "True" }, { IsEvent: "False" }]
        }).sort({ReportTime: 1});

        res.render("adminRequestEvents", { requests, handledrequests });
    } catch (err) {
        console.log(err);
    }
});

//Approving Request
router.post("/ApproveRequestedEvent",adminCheckLoggedIn, async(req,res) =>{
    const {requestId,Reasoning } = req.body;

    try{
        const requestEntry = await Request.findByIdAndUpdate(requestId, {IsEvent: 'True', Reasoning: Reasoning});
        console.log("Updated User: ", requestEntry)

        
        res.redirect(`/CreateEventFromRequest/${requestId}`);
    }catch(err){
        console.log(err)
        res.render('AdminHome')
    }
})

//Request Approval page
router.get("/CreateEventFromRequest/:id",adminCheckLoggedIn, async (req, res) => {
    let id = req.params.id;
    try{
        const request = await Request.findById(id);
        res.render("editPaEventsRequest", {request});
    }catch (err) {
        console.log(err);
    }
});

//Creating a new event of approved Event
router.post("/CreateEventFromRequest/:id",adminCheckLoggedIn, async (req, res) => {
    try {
        const event = new Event({
            EventName: req.body.EventName,
            DateReportTime: new Date(req.body.DateReportTime),
            DateStart: new Date(req.body.DateStart),
            DateEnd: new Date(req.body.DateEnd),
            LiveTime: new Date(req.body.LiveTime),
            AdjustedTime: parseFloat(req.body.AdjustedTime),
            Location: req.body.Location,
            NumOfHours: parseFloat(req.body.NumOfHours),
            Attire: req.body.Attire,
            PACoordinatorName: req.body.PACoordinatorName,
            PACoordinatorOffice: req.body.PACoordinatorOffice,
            PACoordinatorTitle: req.body.PACoordinatorTitle,           
            NumOfPAs: parseInt(req.body.NumOfPAs),
            Description: req.body.Description,

        });
        await event.save();
        console.log("Event saved:", event.toObject()); // Log event to ensure it's saved
        res.redirect('/RequestEvents');
    } catch (err) {
        console.log("Error:", err);
        res.json({ message: err.message, Type: 'danger' });
    }
});


//Rejecting Request
router.post("/rejectRequestedEvent",adminCheckLoggedIn, async(req,res) =>{
    const {requestId, Reasoning } = req.body;

    try{
        const requestEntry = await Request.findByIdAndUpdate(requestId, {IsEvent: 'False', Reasoning: Reasoning });
        console.log("Updated User: ", requestEntry)

        res.redirect(`/RequestEvents`);
    }catch(err){
        console.log(err)
        res.render('AdminHome')
    }
})



//Fetching Edit Event with ID# Page
router.get('/edit/:id',adminCheckLoggedIn, async (req, res) => {
    let id = req.params.id;
    try {
        // Await the result of the findById query
        const event = await Event.findById(id);
        if (!event) {
            return res.redirect('/');
        }
        res.render('editPaEvents', {
            event: event,
        });
    } catch (err) {
        // If there's an error, redirect to the home page
        res.redirect('/');
    }
});

router.post('/editEvents/:id', adminCheckLoggedIn, async (req, res) => {
    console.log("Received POST request for event ID:", req.params.id);
    console.log("Form data:", req.body);

    try {
        const id = req.params.id;

        // Check if roles are enabled
        const enableRoles = req.body.enableRoles === 'yes';

        const roles = enableRoles
            ? {
                golfCartDriver: parseInt(req.body.Roles?.golfCartDriver) || 0,
                leadPA: parseInt(req.body.Roles?.leadPA) || 0,
                senior: parseInt(req.body.Roles?.senior) || 0,
                junior: parseInt(req.body.Roles?.junior) || 0,
                sophomore: parseInt(req.body.Roles?.sophomore) || 0
            }
            : { golfCartDriver: 0, leadPA: 0, senior: 0, junior: 0, sophomore: 0 };

        const updatedEvent = await Event.findByIdAndUpdate(id, {
            EventName: req.body.EventName,
            DateReportTime: new Date(req.body.DateReportTime),
            DateStart: new Date(req.body.DateStart),
            DateEnd: new Date(req.body.DateEnd),
            LiveTime: new Date(req.body.LiveTime),
            AdjustedTime: parseFloat(req.body.AdjustedTime),
            Location: req.body.Location,
            NumOfHours: parseFloat(req.body.NumOfHours),
            Attire: req.body.Attire,
            PACoordinatorName: req.body.PACoordinatorName,
            PACoordinatorOffice: req.body.PACoordinatorOffice,
            PACoordinatorTitle: req.body.PACoordinatorTitle,
            NumOfPAs: parseInt(req.body.numSpots),
            Description: req.body.Description,
            Roles: roles,
            BackUp: parseInt(req.body.BackUp) || 0
        });

        if (updatedEvent) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',
            };
            console.log("EDIT ROUTE HIT. Event ID:", req.params.id);
            console.log("Request body:", req.body);
            res.redirect('/allEvents');
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',
            };
            res.redirect('/AdminHome');
        }
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        console.log(err)
        res.redirect('/AdminHome');

    }
});


// Delete Event route 
router.get('/delete/:id',adminCheckLoggedIn, async(req,res)=>{
    let id = req.params.id;
    try {
        const id = req.params.id;
        const deleteEvent = await Event.findByIdAndDelete(id);
        await Hours.deleteMany({EventId: id})
        if (!(deleteEvent )) {
            return res.redirect('/allEvents');
        }
        res.redirect('/allEvents'); 

    } catch (err) {
        // If there's an error, redirect to the home page
        res.redirect('/');
    }
});

//Request Approval of Hours
router.get("/ApproveHours",adminCheckLoggedIn, async (req, res) => {
    try {
        const hoursData = await Hours.find({Approval: "Waiting for Approval"});
        const eventIds = hoursData.map(hour => hour.EventID);
        const paIds = hoursData.map(pa => pa.UserID);
        const eventData = await Event.find({ _id: { $in: eventIds } }).sort({DateReportTime: 1})
        const paData = await LogIn.find({ _id: { $in: paIds } })

        res.render('RequestApprovalHours', {hoursData, eventData, paData});
        console.log("Hours Data:", hoursData);
        console.log("Event Data:", eventData);
        console.log("PA Data:", paData);

    } catch (err) {

    console.error(err);
    res.status(500).send('Server Error');
}})

//Approving Hours
router.post("/ApprovePAHours", adminCheckLoggedIn, async (req, res) => {
    const { hourId } = req.body;

    try {
        // Fetch the hour entry first
        const hourEntry = await Hours.findById(hourId);

        if (!hourEntry) {
            req.session.message = {
                type: 'danger',
                message: "Hour entry not found.",
            };
            return res.redirect('/AdminHome');
        }

        // Prepare the update object
        const updateFields = { Approval: "Approved" };

        // If RequestedTime exists, add it to the update
        if (hourEntry.RequestedTime !== undefined && hourEntry.RequestedTime !== null) {
            updateFields.HoursEarned = hourEntry.RequestedTime;
        }

        // Perform the update
        await Hours.findByIdAndUpdate(hourId, { $set: updateFields });

        // Load the rest of the entries for rendering
        const hoursData = await Hours.find({ Approval: "Waiting for Approval" });
        const eventIds = hoursData.map(hour => hour.EventID);
        const paIds = hoursData.map(pa => pa.UserID);
        
        const eventData = await Event.find({ _id: { $in: eventIds } });
        const paData = await LogIn.find({ _id: { $in: paIds } });

        res.render('RequestApprovalHours', { hoursData, eventData, paData });

    } catch (err) {
        console.error("Error:", err);  // Log the error for debugging
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        res.render('AdminHome');
    }
});


//Adjusting hours
router.post("/AdjustedPAHours", adminCheckLoggedIn, async (req, res) => {
    const { hourId, hours, reasoning } = req.body;

    try {
        // Fetch the hour entry first
        const hourEntry = await Hours.findById(hourId);

        if (!hourEntry) {
            req.session.message = {
                type: 'danger',
                message: "Hour entry not found.",
            };
            return res.redirect('/AdminHome');
        }

        // Prepare the update object
        const updateFields = { 
            Approval: "Approved", 
            HoursEarned: hours, 
            Reasoning: `${hourEntry.Reasoning} ${reasoning}` 
          };
          

        // If RequestedTime exists, add it to the update
        if (hourEntry.RequestedTime !== undefined && hourEntry.RequestedTime !== null) {
            updateFields.HoursEarned = hourEntry.RequestedTime;
        }

        // Perform the update
        await Hours.findByIdAndUpdate(hourId, { $set: updateFields });

        // Load the rest of the entries for rendering
        const hoursData = await Hours.find({ Approval: "Waiting for Approval" });
        const eventIds = hoursData.map(hour => hour.EventID);
        const paIds = hoursData.map(pa => pa.UserID);
        
        const eventData = await Event.find({ _id: { $in: eventIds } });
        const paData = await LogIn.find({ _id: { $in: paIds } });

        res.render('RequestApprovalHours', { hoursData, eventData, paData });

        console.log("Hours Data:", hoursData);
        console.log("Event Data:", eventData);
        console.log("PA Data:", paData);

    } catch (err) {
        console.error("Error:", err);  // Log the error for debugging
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        res.render('AdminHome');
    }
});

//Request Approval of Hours
router.get("/RequestCancellation",adminCheckLoggedIn, async (req, res) => {
    try {
        const hoursData = await Hours.find({Approval: "Waiting for Removal"});
        const eventIds = hoursData.map(hour => hour.EventID);
        const paIds = hoursData.map(pa => pa.UserID);
        const allusers = await UserInfo.find({Role: "President Ambassador"})
        const eventData = await Event.find({ _id: { $in: eventIds } }).sort({DateReportTime: 1})
        const paData = await LogIn.find({ _id: { $in: paIds } })

        res.render('AdminRequestCancel', {hoursData, eventData, paData, allusers});
        console.log("Hours Data:", hoursData);
        console.log("Event Data:", eventData);
        console.log("PA Data:", paData);

    } catch (err) {

    console.error(err);
    res.status(500).send('Server Error');
}})

//Request Approval of Hours
router.post("/ApproveCancellation",adminCheckLoggedIn, async (req, res) => {
    const { hourId, paId } = req.body;
    try {
        // Fetch the hour entry first
        const update = await Hours.findById(hourId);

        if (!update) {
            return res.redirect("/adminHome"); }
        
        if (update.SwitchPA !== "No one is available") {
            //Getting correct ID
            const paInfo = await UserInfo.findById(paId);
            if (!paInfo) {
                return res.status(404).send("PA not found");}
            const userEmail = paInfo.Email;
            
            // Now find the Login document using that email
            const loginUser = await LogIn.findOne({ UserName: userEmail }); // Adjust the model name if needed
            if (!loginUser) {
                return res.status(404).send("Login info not found");}
            
            // Now set the new data
            const newData = {
                UserID: loginUser._id, // This is what you're looking for
                SwitchPA: null,
                Approval: null,
                Reasoning: "Credit hours met",};
            
            await Hours.findByIdAndUpdate(hourId, { $set: newData });
        } else {
            await Hours.findByIdAndDelete(hourId);
        }  
        res.redirect("/RequestCancellation")

    } catch(err){
        console.log("Approve Cancellation Error: ", err)
        res.redirect("/RequestCancellation")
    }
})

////Request Approval of Hours
router.post("/AdjustedCancellation",adminCheckLoggedIn, async (req, res) => {
    const { hourId, NewPa } = req.body;
    try {
        // Fetch the hour entry first
        const update = await Hours.findById(hourId);

        if (!update) {
            return res.redirect("/adminHome"); }
        
        if (NewPa !== "No one is available") {
            //Getting correct ID
            const paInfo = await UserInfo.findById(NewPa);
            if (!paInfo) {
                return res.status(404).send("PA not found");}
            const userEmail = paInfo.Email;
            
            // Now find the Login document using that email
            const loginUser = await LogIn.findOne({ UserName: userEmail }); // Adjust the model name if needed
            if (!loginUser) {
                return res.status(404).send("Login info not found");}
            
            // Now set the new data
            const newData = {
                UserID: loginUser._id, // This is what you're looking for
                SwitchPA: null,
                Approval: null,
                Reasoning: "Credit hours met",};
            
            await Hours.findByIdAndUpdate(hourId, { $set: newData });
        } else {
            await Hours.findByIdAndDelete(hourId);
        }  
        res.redirect("/RequestCancellation")

    } catch(err){
        console.log("Approve Cancellation Error: ", err)
        res.redirect("/RequestCancellation")
    }
})

router.post("/denialCancellation",adminCheckLoggedIn, async (req, res) => {
    const { hourId } = req.body;
    try {
        // Fetch the hour entry first
        const update = await Hours.findById(hourId);

        if (!update) {
            return res.redirect("/adminHome"); }
        
            // Now set the new data
            const newData = {
                SwitchPA: null,
                Approval: null,
                Reasoning: "Credit hours met",};
            
            await Hours.findByIdAndUpdate(hourId, { $set: newData });
       
        res.redirect("/RequestCancellation")

    } catch(err){
        console.log("Approve Cancellation Error: ", err)
        res.redirect("/RequestCancellation")
    }

})


//Get Accounts
router.get("/accounts",adminCheckLoggedIn, async (req, res) => {


    try {
        const usersAdmin = await UserInfo.find({ Role: 'Admin' }).sort({lName: 1, fName: 1}); // Query the database
        const users = await UserInfo.find({ Role: 'President Ambassador' }).sort({lName: 1, fName: 1});
        res.render('Accounts', { usersAdmin, users }); // Pass data to EJS template
         // Query the database
        // res.render('Accounts', { users }); // Pass data to EJS template
    } catch (err) {
        console.error(err);
    }
})


//Viewing PA hours Page
router.get("/ViewPaHours", adminCheckLoggedIn, async (req, res) => {
    try {
        // Fetch all PAs
        const paData = await UserInfo.find({Role: 'President Ambassador'}).sort({lName: 1, fName: 1});

        // Fetch related data
        const approvedHours = await Hours.find({ Approval: "Approved" });
        const paUser = await LogIn.find();
        const eventIds = approvedHours.map(hour => hour.EventID);
        const eventData = await Event.find({ _id: { $in: eventIds } }).sort({DateReportTime:1});

        // 💡 Map all PAs, even those without approved hours
        const paHoursData = paData.map(pa => {
            const user = paUser.find(user => user.UserName === pa.Email);

            // Filter approved hours for this PA (if they exist)
            const hoursForPa = user
                ? approvedHours.filter(hour => hour.UserID.toString() === user._id.toString())
                : [];

            // Calculate total hours (0 if none found)
            const totalHours = hoursForPa.reduce((sum, hour) => sum + (hour.HoursEarned || 0), 0);

            // Get event names or empty array if none
            const events = hoursForPa.length > 0
                ? hoursForPa.map(hour => {
                    const event = eventData.find(
                        e => e._id.toString() === hour.EventID.toString());
                    return event ? event.EventName : "Unknown Event";
                })
                : [];
            return {
                fName: pa.fName,
                lName: pa.lName,
                totalHours,
                events
            };
        });

        // Render the page with complete PA list
        res.render('adminPAHours', { paHoursData });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});



//Create new Account Page
router.get("/NewUser",adminCheckLoggedIn, (req, res) => {
    res.render("CreateUser");
})

//Create new Account Functionality
router.post("/NewUser", adminCheckLoggedIn, async (req, res) => {
    const existingUser = await UserInfo.findOne({Email: req.body.Email,})
    if(existingUser){
        res.send("User already exists. Please choose a different method.")
    }
    try {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = Date.now() + 2000 * 60 * 60;
        const saltRounds = 10; 
        const hashedPw = await bcrypt.hash("placeholder", saltRounds);
            
        const userLogin = await LogIn.create({
            UserName: req.body.Email,
            Password: hashedPw,
            PasswordResetToken: token,
            PasswordResetExpires: tokenExpiry,
          });

        const user = new UserInfo({
            UserID: req.body.UserID,
            fName: req.body.fName,
            lName: req.body.lName,
            GraduationSemester: req.body.GraduationSemester,
            GraduationYear: req.body.GraduationYear,
            Email: req.body.Email,           
            Role: req.body.Role,
            GolfCart: req.body.GolfCart,
        });
        await user.save();

        const resetLink = `http://localhost:3000/create-password/${token}`;
        const mailOptions = {
            from: "quixy4101@gmail.com",
            to: req.body.Email,
            subject: "Set up your PA account password",
            text: `Welcome! Click the following link to create your password: ${resetLink}`,
        };

        await transporter.sendMail(mailOptions);

        console.log("Email sent and user created!");
        res.redirect('/Accounts');
    } catch (err) {
    console.error("Error:", err);
    console.log("Error when creating user: ", err);
    res.json({ message: err.message, Type: 'danger' });}
});

// Rendering Editing User Page
router.get('/editUser/:id',adminCheckLoggedIn, async (req, res) => {
    let id = req.params.id;
    try {
        // Await the result of the findById query
        const users = await UserInfo.findById(id);
        if (!users) {
            return res.redirect('/Accounts');
        }
        res.render('EditUser', {
            users: users,
        });
    } catch (err) {
        // If there's an error, redirect to the home page
        console.error(err);
        res.redirect('/Accounts');
    }
});

//Edit Function with ID#
router.post('/editUser/:id',adminCheckLoggedIn, async (req, res) => {
    console.log("Received POST request for User ID:", req.params.id);

    try {
        const id = req.params.id;
        const updateduser = await UserInfo.findByIdAndUpdate(id, {
            UserID: req.body.UserID,
            fName: req.body.fName,
            lName: req.body.lName,
            GraduationSemester: req.body.GraduationSemester,
            GraduationYear: req.body.GraduationYear,
            Email: req.body.Email,           
            Role: req.body.Role,
            GolfCart: req.body.GolfCart,
        });
        console.log("Updated User:", updateduser);
        if (updateduser) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',
            };
            res.redirect('/Accounts');
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',
            };
            res.redirect('/AdminHome');
        }
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        console.error(err);
        res.redirect('/AdminHome');
    }
});

//Delete User
router.get('/deleteUser/:id',adminCheckLoggedIn, async(req,res)=>{
    //let id = req.params.id;
    try {
        const id = req.params.id;
    
        // Step 1: Find the UserInfo document to get the email
        const userInfo = await UserInfo.findById(id);
        if (!userInfo) {
            return res.redirect('/Accounts');}

        const userEmail = userInfo.Email;
    
        // Step 2: Delete from UserInfo
        await UserInfo.findByIdAndDelete(id);
    
        // Step 3: Delete the matching login using the email
        await LogIn.findOneAndDelete({ UserName: userEmail });
    
        res.redirect('/Accounts');
    } catch (err) {
        console.error("Error deleting user:", err);
        res.redirect('/');
    }
});

//**************************************
//President Ambassador Routes
//**************************************

//PA Home Page
router.get("/PAHome",paCheckLoggedIn, async(req, res) => {
   try{
    console.log("PAHome route triggered"); // Check if the route is being hit
        const userId = req.session.user.id; 

        //Finding events signed up for
        const hoursData = await Hours.find({ UserID: userId });
        const eventIds = hoursData.map(hour => hour.EventID);
        const eventData = await Event.find({ _id: { $in: eventIds } })


        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();   // 💡 Define this here
        const currentYear = currentDate.getFullYear(); // 💡 And this too

       // const currentDate = new Date();
        const futureEvents = eventData.filter(event => {
            const eventDate = new Date(event.DateReportTime);
            return (
                eventDate > currentDate && 
                eventDate.getMonth() === currentMonth && 
                eventDate.getFullYear() === currentYear
            );
        });
       
        // Hours that are not approved or have not happened
        const hoursPendingApproval = hoursData
            .filter(hour => eventIds.includes(hour.EventID.toString()) && hour.Approval !== "Approved")
            .reduce((total, hour) => total + hour.HoursEarned, 0);

        // Hours that have been approved
        const totalApprovedHours = hoursData
            .filter(hour => eventIds.includes(hour.EventID.toString()) && hour.Approval === "Approved")
            .reduce((total, hour) => total + hour.HoursEarned, 0);
        
        //Total Hours
        const totalHours = hoursPendingApproval+totalApprovedHours

        res.render("paHome", {totalApprovedHours, hoursPendingApproval, totalHours, futureEvents});

}catch(err){}
    
});

// PA events Page
router.get("/paAddEvents", paCheckLoggedIn, async (req, res) => {
    try {
        console.log("Pa Events page")    
        const userId = req.session.user.id;

        const events = await Event.find({ DateReportTime: { $gt: new Date() } }).sort({ DateReportTime: 1 });
        const pastEvents = await Event.find({ DateReportTime: { $lt: new Date() } }).sort({ DateReportTime: 1 });

        const userSignups = await Hours.find({ UserID: userId });
        const signedUpEventIds = new Set(userSignups.map(signup => signup.EventID.toString()));

        const eventSignupCounts = {};
        const eventRoleCounts = {};

        for (const event of events) {
            const eventId = event._id;

            const hours = await Hours.find({ EventID: eventId });
            eventSignupCounts[eventId] = hours.length;

            // Count per role
            const roleCounts = {}; // This should be declared outside the loop for each event
            for (const hour of hours) {
                const role = hour.role || "Unassigned"; // Use 'role' consistently, fallback to "Unassigned"
                
                if (!eventRoleCounts[eventId]) eventRoleCounts[eventId] = {};
                
                // Update the count for the current role
                eventRoleCounts[eventId][role] = (eventRoleCounts[eventId][role] || 0) + 1;
            }            
        }
        console.log(eventRoleCounts)

        res.render("paAddEvents", {
            events,
            signedUpEventIds,
            eventSignupCounts,
            eventRoleCounts,
            pastEvents
        });
    } catch (err) {
        res.json({ message: err.message });
    }
});


router.post('/paSignup', paCheckLoggedIn, async (req, res) => {
    try {
        const { eventId, role } = req.body;
        const event = await Event.findById(eventId);
        console.log(eventId, role)
        if (!event) {
            return res.status(404).send("Event not found");
        }

        const Signup = new Hours({
            UserID: req.session.user.id,
            EventID: event._id,
            HoursEarned: event.NumOfHours,
            Reasoning: "Credit hours met",
            ...(role && { role: role }) // only include if role exists
        });

        await Signup.save();
        console.log("Event saved:", Signup.toObject());

        res.redirect("/paAddEvents");
    } catch (err) {
        console.log("Error:", err);
        res.status(500).json({ message: err.message, Type: 'danger' });
    }
});


//
router.get("/paView/:id", paCheckLoggedIn, async (req, res) => {
    let id = req.params.id;
    try {
        const event = await Event.findById(id);
        if (!event) return res.redirect('/');

        // Get Hours records for this event
        const eventData = await Hours.find({ EventID: event._id });

        // Get LogIn records for those UserIDs
        const userIds = eventData.map(data => data.UserID);
        const userLogins = await LogIn.find({ _id: { $in: userIds } });

        // Map login _id -> email for lookup
        const idToEmail = Object.fromEntries(userLogins.map(login => [login._id.toString(), login.UserName]));

        // Get corresponding UserInfo entries by email
        const emails = Object.values(idToEmail);
        const userInfos = await UserInfo.find({ Email: { $in: emails } });

        // Attach role and hourId to each user
        const userNames = userInfos.map(user => {
            const login = userLogins.find(login => login.UserName === user.Email);
            const hour = login ? eventData.find(h => h.UserID === login._id.toString()) : null;

            return {
                ...user.toObject(),
                role: hour?.role || null,
                hourId: hour?._id.toString() || null,
                loginId: login?._id.toString() || null
            };
        });

        // Find all available users (not signed up)
        const allusers = await UserInfo.find({
            Role: 'President Ambassador',
            Email: { $nin: emails }
        });

        res.render('paViewEvent', { event, userNames, allusers });

    } catch (err) {
        console.error('Error:', err);
        res.redirect('/');
    }
});




//PA Hours Page
router.get("/paCheckHours",paCheckLoggedIn, async (req, res) => {
    try {
            const userId = req.session.user.id
            const hoursData = await Hours.find({ UserID: userId });
            const eventIds = hoursData.map(hour => hour.EventID);
            const eventData = await Event.find({ _id: { $in: eventIds } }).sort({ DateReportTime: 1 });

            const currentDate = new Date();
            const futureEvents = eventData.filter(event => new Date(event.DateReportTime) > currentDate);
            const completedEvents = eventData.filter(event => new Date(event.DateReportTime) <= currentDate);

            const ApprovedEvents = completedEvents.filter(event => {
                const hourEntry = hoursData.find(hour => hour.EventID.toString() === event._id.toString());
                return hourEntry && hourEntry.Approval === "Approved";
            });

            const PendingEvents = completedEvents.filter(event => {
                const hourEntry = hoursData.find(hour => hour.EventID.toString() === event._id.toString());
                return hourEntry && hourEntry.Approval !== "Approved";
            });
            //const userNames = await UserInfo.find({ Email: { $in: emails } });
            const allusers = await UserInfo.find({
                Role: 'President Ambassador',
            });

            res.render('paCheckHours', { hoursData, ApprovedEvents, PendingEvents, futureEvents, allusers});
        } catch (err) {

        console.error(err);
        res.status(500).send('Server Error');
    }

})

// Adjusting Hours
router.post("/submitAdjustedHours", paCheckLoggedIn, async (req, res) => {
    const { hourId, hours, reasoning, NewPa } = req.body;
    try {
        // Find the hour entry by ID and update it
        const hourEntry = await Hours.findByIdAndUpdate(hourId, {
            RequestedTime: hours,
            Reasoning: reasoning,
            Approval: "Waiting for Approval",
        });
            res.redirect('/paCheckHours')
        if (hourEntry) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',
            };
            res.redirect('paCheckHours')
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',
            };
            res.redirect('paCheckHours')
        }
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        // Pass the data back to the view even in case of an error
        res.redirect('paCheckHours');
    }
});

// Approve Hours
router.post("/submitApprovalHours", async (req, res) => {
    const { hourId, hours, reasoning } = req.body;
    try {
        // Find the hour entry by ID and update it
        const hourEntry = await Hours.findByIdAndUpdate(hourId, {
            RequestedTime: hours,
            Reasoning: reasoning,
            Approval: "Waiting for Approval",
        });

            res.redirct('/paCheckHours')

        if (hourEntry) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',};
            res.redirect('/paCheckHours') //, { hoursData, futureEvents, completedEvents });
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',};
            res.redirect('/paCheckHours');
        }
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        // Pass the data back to the view even in case of an error
        res.redirect('/paCheckHours');
    }
});


// Canceling Registration
router.post('/DeleteEventHours', paCheckLoggedIn, async (req, res) => {
    const { hourId, hours, reasoning } = req.body;
    try {
        // Find the hour entry by ID and update it
        const hourEntry = await Hours.findByIdAndDelete(hourId)

        if (!hourEntry) {
            return res.redirect('/PAHome');
        }
        res.redirect('/paCheckHours');
        
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        // Pass the data back to the view even in case of an error
        res.redirect('/PAHome');
    }
});

// Canceling Request to cancel Registration
router.post('/RequestDeleteEventHours', paCheckLoggedIn, async (req, res) => {
    const { hourId, reasoning, NewPa } = req.body;
    try {
        // Find the hour entry by ID and update it
        const hourEntry = await Hours.findByIdAndUpdate(hourId, {
            Reasoning: reasoning,
            Approval: "Waiting for Removal",
            SwitchPA: NewPa, });

            res.redirct('paCheckHours')

        if (hourEntry) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',};
            res.redirect('/paCheckHours') //, { hoursData, futureEvents, completedEvents });
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',};
            res.redirect('/paCheckHours');
        }
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        // Pass the data back to the view even in case of an error
        res.redirect('/paCheckHours');
    }
});

//PA Resources Page
router.get("/paResources",paCheckLoggedIn, (req, res) => {
    res.render("paResources");
})


module.exports = router;