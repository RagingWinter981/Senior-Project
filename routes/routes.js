const express = require('express');
const mongoose = require("mongoose");
const router = express.Router();
const Event = require('../models/EventInfo');
const UserInfo = require('../models/UserInfo');
const LogIn = require('../models/LogIn');
const Hours = require('../models/Hours');
const Request = require('../models/RequestInfo');
const bcrypt = require('bcrypt');
const { adminCheckLoggedIn,paCheckLoggedIn, bypassLogin } = require('../functions');



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
    res.redirect('AdminHome');
})

router.get("/Login",bypassLogin, async (req, res) => {
    res.render('index');
})

router.post("/Login", async (req, res) => {
    try{
        const check = await LogIn.findOne({UserName: req.body.UserName,});
        const checktype =  await UserInfo.findOne({Email: req.body.UserName,});
        if (!check){
            res.send("Username cannot be found")
        }
        const isPwMatch= await bcrypt.compare(req.body.Password, check.Password);
        if(isPwMatch)
        {
            req.session.user = {id: check._id, username: check.UserName, type: checktype.Role} 
        if (req.session.user.type == 'Admin'){
            res.redirect("/adminHome")}
        else if(req.session.user.type == 'President Ambassador'){
            res.redirect("/PAHome") }   
        }
    }catch{

    }
})


//Admin Home Page
router.get("/adminHome",adminCheckLoggedIn, async(req, res) => {
    try{
        const hoursData = await Hours.find();
        const eventData = await Event.find();

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

router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('manfra.io')
        res.redirect("/Login");
    });
  });
  

//Admin Create Events Page with Create Function
router.post("/events",adminCheckLoggedIn, async (req, res) => {
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
        res.redirect('/adminHome');
    } catch (err) {
        console.log("Error:", err);
        res.json({ message: err.message, Type: 'danger' });
    }
});

//Fetching Search Events Page
router.get("/allEvents",adminCheckLoggedIn, async (req, res) => {
    try {
        const events = await Event.find(); // Fetch data from the database
        console.log(events); // Log the events to check the structure
        res.render("AdminSearchEvent", { events });
    } catch (err) {
        res.json({ message: err.message }); // Handle errors
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
        const allusers = await UserInfo.find({Role: 'President Ambassador'});
        res.render('AdminViewEvent', { event, userNames, allusers });

    } catch (err) {
        console.error('Error:', err);
        res.redirect('/');
    }
});

//
router.post("/SwitchShift", adminCheckLoggedIn, async (req, res) => {
    const {hourId,Pa } = req.body;
    // try {
    //     const updateEvent = Hours.findOneAndUpdate({EventID: hourId,},{UserID: Pa})
    // }

});




//Request Approval page
router.get("/RequestEvents",adminCheckLoggedIn, async (req, res) => {
    try {
        const requests = await Request.find({ IsEvent: { $exists: false } });

        // Use MongoDB's $or operator
        const handledrequests = await Request.find({
            $or: [{ IsEvent: "True" }, { IsEvent: "False" }]
        });

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


//Rejjecting Request
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

//Edit Function with ID#
router.post('/editEvents/:id',adminCheckLoggedIn, async (req, res) => {
    console.log("Received POST request for event ID:", req.params.id);
    try {
        const id = req.params.id;
        const updatedEvent = await Event.findByIdAndUpdate(id, {
            EventName: req.body.EventName, 
            DateReportTime: new Date(req.body.DateReportTime),
            DateStart: new Date(req.body.DateStart),
            DateEnd: new Date(req.body.DateEnd),
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

        if (updatedEvent) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',
            };
            res.redirect('/allEvents');
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',
            };
            res.redirect('/allEvents');
        }
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        res.redirect('/allEvents');
    }
});

// Delete Event route 
router.get('/delete/:id',adminCheckLoggedIn, async(req,res)=>{
    let id = req.params.id;
    try {
        const id = req.params.id;
        const deleteEvent = await Event.findByIdAndDelete(id);
        if (!deleteEvent) {
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
        const eventData = await Event.find({ _id: { $in: eventIds } })
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

//Get Accounts
router.get("/accounts",adminCheckLoggedIn, async (req, res) => {


    try {
        const usersAdmin = await UserInfo.find({ Role: 'Admin' }); // Query the database
        const users = await UserInfo.find({ Role: 'President Ambassador' });
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
        const paData = await UserInfo.find({Role: 'President Ambassador'});

        // Fetch related data
        const approvedHours = await Hours.find({ Approval: "Approved" });
        const paUser = await LogIn.find();
        const eventIds = approvedHours.map(hour => hour.EventID);
        const eventData = await Event.find({ _id: { $in: eventIds } });

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
    else{
        try {
            const saltRounds = 10; 
            const hashedPw = await bcrypt.hash("1234", saltRounds);
            
            console.log("Hashed Password: ", hashedPw)
            const data ={
                UserName: req.body.Email, 
                Password: hashedPw,}

        //Hash the password using bycrypt
        const userdate = await LogIn.create(data);
        console.log("Login saved:", userdate.toObject()); // Log event to ensure it's saved
        
        // res.redirect('/Accounts');
        } catch (err) {
            console.log("Error:", err);
            res.json({ message: err.message, Type: 'danger' });
        }

        try {
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
            console.log("Event saved:", user.toObject()); // Log event to ensure it's saved
            res.redirect('/Accounts');
        } catch (err) {
            console.log("Error:", err);
            res.json({ message: err.message, Type: 'danger' });
        }
    }
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
    let id = req.params.id;
    try {
        const id = req.params.id;
        const deleteUser = await UserInfo.findByIdAndDelete(id);
        if (!deleteUser) {
            return res.redirect('/Accounts');
        }
        res.redirect('/Accounts'); 

    } catch (err) {
        // If there's an error, redirect to the home page
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
router.get("/paAddEvents",paCheckLoggedIn, async (req, res) => {
    try {
        //all events    
        console.log("Pa Events page")    
        const userId = req.session.user.id; 
        const events = await Event.find(); // Fetch data from the database

        //signed up for events
        const userSignups = await Hours.find({ UserID: userId });
        const signedUpEventIds = new Set(userSignups.map(signup => signup.EventID.toString()));

        // number of spots
        const eventSignupCounts = {};

        for (const event of events) {
            const count = await Hours.countDocuments({ EventID: event._id });
            eventSignupCounts[event._id] = count;
        }
        //past events 

        res.render("paAddEvents", { events,signedUpEventIds, eventSignupCounts });
    } catch (err) {
        res.json({ message: err.message }); // Handle errors
    }
})

//Signing up for an event
router.get('/paSignup/:id', paCheckLoggedIn,async(req,res)=>{
    try {
        const id = req.params.id;
        const event = await Event.findById(id)
        //const Id = req.session.user.id

        const Signup = new Hours({
            UserID: req.session.user.id,
            EventID: event._id,
            HoursEarned: event.NumOfHours,
            Reasoning: "Credit hours met",
        });
        await Signup.save();
        console.log("Event saved:", Signup.toObject());

        //all events        
        const userId = req.session.user.id; 
        const events = await Event.find(); // Fetch data from the database

        //signed up for events
        const userSignups = await Hours.find({ UserID: userId });
        const signedUpEventIds = new Set(userSignups.map(signup => signup.EventID.toString()));

        // number of spots
        const eventSignupCounts = {};

        for (const event of events) {
            const count = await Hours.countDocuments({ EventID: event._id });
            eventSignupCounts[event._id] = count;
        }
        //past events 

        res.render("paAddEvents", { events,signedUpEventIds, eventSignupCounts });
    } catch (err) {
        console.log("Error:", err);
        res.json({ message: err.message, Type: 'danger' });
    }

})



//PA Hours Page
router.get("/paCheckHours",paCheckLoggedIn, async (req, res) => {
    try {
            const userId = req.session.user.id
            const hoursData = await Hours.find({ UserID: userId });
            const eventIds = hoursData.map(hour => hour.EventID);
            const eventData = await Event.find({ _id: { $in: eventIds } })

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

            res.render('paCheckHours', { hoursData, ApprovedEvents, PendingEvents, futureEvents });
        } catch (err) {

        console.error(err);
        res.status(500).send('Server Error');
    }

})

// Adjusting Hours
router.post("/submitAdjustedHours", paCheckLoggedIn, async (req, res) => {
    const { hourId, hours, reasoning } = req.body;
    try {
        // Find the hour entry by ID and update it
        const hourEntry = await Hours.findByIdAndUpdate(hourId, {
            RequestedTime: hours,
            Reasoning: reasoning,
            Approval: "Waiting for Approval",
        });

        const userId = req.session.user.id
            const hoursData = await Hours.find({ UserID: userId });
            const eventIds = hoursData.map(hour => hour.EventID);
            const eventData = await Event.find({ _id: { $in: eventIds } })

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

            res.render('paCheckHours', { hoursData, ApprovedEvents, PendingEvents, futureEvents });

        if (hourEntry) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',
            };
            // Pass the updated data back to the view
            res.render('paCheckHours', { hoursData, futureEvents, completedEvents });
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',
            };
            // Pass the updated data back to the view
            res.render('paCheckHours', { hoursData, futureEvents, completedEvents });
        }
    } catch (err) {
        req.session.message = {
            type: 'danger',
            message: err.message,
        };
        // Pass the data back to the view even in case of an error
        res.render('paCheckHours');
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

        const userId = req.session.user.id
            const hoursData = await Hours.find({ UserID: userId });
            const eventIds = hoursData.map(hour => hour.EventID);
            const eventData = await Event.find({ _id: { $in: eventIds } })

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

            res.redirect('/paCheckHours')//, { hoursData, ApprovedEvents, PendingEvents, futureEvents });

        if (hourEntry) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',
            };
            // Pass the updated data back to the view
            res.redirect('/paCheckHours') //, { hoursData, futureEvents, completedEvents });
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',
            };
            // Pass the updated data back to the view
            //res.render('paCheckHours', { hoursData, futureEvents, completedEvents });
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

//Requesting To cancel Registration

//PA Resources Page
router.get("/paResources",paCheckLoggedIn, (req, res) => {
    console.log("I dont understand")
    res.render("paResources");
})



module.exports = router;