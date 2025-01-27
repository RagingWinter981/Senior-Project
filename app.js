const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://ksmith30:A11Th3Stars@seniorproject.brwao.mongodb.net/?retryWrites=true&w=majority&appName=SeniorProject";

async function main(){
  const client = new MongoClient(uri);

  try{
    await client.connect();

    //inserting one event
    // await listDatabases(client);
    // createEvent(client, {
    //   EventName: "President Ambassador Social",
    //   NumOfHours: 2,
    //   Location: "One Camino Santa Maria, San Antonio, TX, 78228",
    //   DateStart: "2025-01-31-T12:00:00",
    //   EndTime: "2025-01-31-T14:00:00",
    //   NumOfPAs: 30,
    //   PACoordinator: "Allison Grijalva",
    //   ReportTime: "2025-01-31-T11:30:00",
    //   AdjustedTime: 30,
    //   Description: "Meet all Alumni PAs!"
    // })

    //inserting multiple events
    // await createMultipleEvents(client, [
    //   {
    //     EventName: "Boo Bash",
    //     NumOfHours: 1,
    //     Location: "One Camino Santa Maria, San Antonio, TX, 78228",
    //     DateStart: "2025-10-31-T19:00:00",
    //     EndTime: "2025-10-31-T20:00:00",
    //     NumOfPAs: 4,
    //     PACoordinator: "Allison Grijalva",
    //     ReportTime: "2025-10-31-T18:45:00",
    //     AdjustedTime: 15,
    //     Description: "Assist with President Ambassador booth at Boo Bash"
    //   },
    //   {
    //     EventName: "Spring Fun Run",
    //     NumOfHours: 7,
    //     Location: "One Camino Santa Maria, San Antonio, TX, 78228",
    //     DateStart: "2025-03-14-T9:00:00",
    //     EndTime: "2025-03-14-T16:00:00",
    //     NumOfPAs: 30,
    //     PACoordinator: "Allison Grijalva",
    //     ReportTime: "2025-03-14-T8:30:00",
    //     AdjustedTime: 30,
    //     Description: "Set up for the Spring 5K"
    //   }]
    // );

    // await findOneEventByName(client, "Boo Bash")

    await FindEventsMinHoursMinPAs(client, {minHours: 3, minPAs: 3});

  }catch (e){
    console.error(e)
  }finally {
    await client.close();
  }
}

main().catch(console.error)

//inserting one
async function createEvent(client, newEvent){
  const result = await client.db("PAApp").collection("EventInfo").insertOne(newEvent);
  console.log(`New listing created with the following ID: ${result.insertedId}`);
}

//inserting Multiple events
async function createMultipleEvents(client, newEvents){
  const result = await client.db("PAApp").collection("EventInfo").insertMany(newEvents);
  console.log(`${result.insertedCount} New listings created with the following IDs: `);
  console.log(result.insertedIds);
}

//Search Function by Event Name
async function findOneEventByName(client, nameOfEvent){
  const result = await client.db("PAApp").collection("EventInfo").findOne({EventName: nameOfEvent});

  if (result) {
    console.log(`Found a listing in the collection with the name '${nameOfEvent}'`);
    console.log(result);
  }else {console.log(`No Listings found with the name '${nameOfEvent}`);}
}

//Search Multiple events
async function FindEventsMinHoursMinPAs(client, {minHours = 0, minPAs = 0} = {}){

  const cursor = await client.db("PAApp").collection("EventInfo").find({
    NumOfHours: {$gte: minHours},
    NumOfPAs: {$gte: minPAs}
    
  }).sort({DateStart: 1});
  //.limit();

   const results = await cursor.toArray();

   if (results.length > 0) {
    console.log(`Found listing(s) with at least ${minHours} hour(s) and ${minPAs} PA(s): `);
    results.forEach((result, i) =>{
      date = new Date(result.DateStart).toDateString();
      console.log();
      console.log(`${i +1}. Name: ${result.EventName}`);
      console.log(`   _id: ${result._id}`);
      console.log(`   Location: ${result.Location}`);
      console.log(`   DateStart: ${new Date(result.DateStart).toDateString()}`);
      console.log(`   NumOfPAs: ${result.NumOfPAs}`);
      console.log(`   PACoordinator: ${result.PACoordinator}`);
      console.log(`   Description: ${result.Description}`);
    });
   }else{
      console.log(`No Listings found with at least ${minHours} hours and and ${minPAs} PA(s)`);
   };
    }

async function listDatabases(client){

  const databasesList = await client.db().admin().listDatabases();

  console.log("Databases:")
  databasesList.databases.forEach(db => {
    console.log(`- ${db.name}`);
  })

}
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });
// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
//     // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
//     // Ensures that the client will close when you finish/error
//     await client.close();
//   }
// }
// run().catch(console.dir);