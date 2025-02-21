const express = require('express');
const router = express.Router();
const Event = require('../models/EventInfo');
const UserInfo = require('../models/UserInfo');
const LogIn = require('../models/LogIn');
const bcrypt = require('bcrypt');
const { adminCheckLoggedIn,paCheckLoggedIn, bypassLogin } = require('../functions');

router.get("/",adminCheckLoggedIn, (req, res) => {
    res.render('AdminHome');
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
            res.render("AdminHome")}
        else if(req.session.user.type == 'President Ambassador'){
            res.render("paHome") }   
        }
    }catch{

    }
    })

router.get("/PAHome",paCheckLoggedIn, (req, res) => {
    res.render("paHome");
})

//Admin Home Page
router.get("/adminHome",adminCheckLoggedIn, (req, res) => {
    res.render("AdminHome");
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

module.exports = router;