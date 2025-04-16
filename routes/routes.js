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
const User = require('../models/UserInfo');



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
        const events = await Event.find({DateReportTime:  { $gt: new Date() } }).sort({DateReportTime: 1}); // Fetch data from the database
        const pastEvents = await Event.find({DateReportTime:  { $lt: new Date() } }).sort({DateReportTime: 1});
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

        res.render("paAddEvents", { events,signedUpEventIds, eventSignupCounts, pastEvents });
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

        res.redirect("/paAddEvents")
    } catch (err) {
        console.log("Error:", err);
        res.json({ message: err.message, Type: 'danger' });
    }

})

//
router.get("/paView/:id", paCheckLoggedIn, async (req, res) => {
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
            res.redirct('/paCheckHours')
        if (hourEntry) {
            req.session.message = {
                type: 'success',
                message: 'Event updated successfully',
            };
            res.redirct('paCheckHours')
        } else {
            req.session.message = {
                type: 'danger',
                message: 'Event not found',
            };
            res.redirct('paCheckHours')
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