const express = require('express');
const router = express.Router();
const Event = require('../models/EventInfo');

router.get("/", (req, res) => {
    res.render('index');
})


router.post("/events", async (req, res) => {
    console.log("Request Body:", req.body); // Ensure this logs the expected data
    try {
        const event = new Event({
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
        await event.save();
        console.log("Event saved:", event.toObject()); // Log event to ensure it's saved
        res.redirect('/adminHome');
    } catch (err) {
        console.log("Error:", err);
        res.json({ message: err.message, Type: 'danger' });
    }
});

router.get("/events", (req, res) => {
    res.render("CreateEvent");
})
router.get("/adminHome", (req, res) => {
    res.render("AdminHome");
})

router.get("/allEvents", async (req, res) => {
    try {
        const events = await Event.find(); // Fetch data from the database
        console.log(events); // Log the events to check the structure
        res.render("AdminSearchEvent", { events });
    } catch (err) {
        res.json({ message: err.message }); // Handle errors
    }
});
    

router.get('/edit/:id', async (req, res) => {
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

//update user route
router.post('/editEvents/:id', async (req, res) => {
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
            res.redirect('/AdminSearchEvent');
        } else {
            res.json({ message: 'Event not found' });
        }
    } catch (err) {
        res.json({ message: err.message, type: 'danger' });
    }
});



module.exports = router;