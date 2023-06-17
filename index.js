const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const {
  MongoClient,
  ServerApiVersion,
  ChangeStream,
  ObjectId,
} = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

//middeleware
app.use(cors());
app.use(express.json());

// verify jwt token

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "you are not authenticated" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "you are not authenticated" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vgwn8xr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("eliteSports").collection("users");
    const classesCollection = client.db("eliteSports").collection("classes");
    const selectedClassesCollection = client.db("eliteSports").collection("selectedClass");
    const enrollClassCollection = client.db("eliteSports").collection("enrollClass");

  
  
    // create jwt token

    app.post("/jwt", (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        res.send({ token });
      });
  


    // create payment intent
    app.post('/create-payment-intent',  async (req, res) => {
      const { price } = req.body
     

     const amount = parseFloat(price) * 100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      })
    
      
    
   res.send({  clientSecret: paymentIntent.client_secret,
      })
    })


// enroll class related api-----------------------------

// get specific  enrolled class data by email

app.get("/enrollClass/all", verifyJWT, async (req, res) => {
  const email = req.query.email;
  const decodedEmail = req.decoded.email;
  // console.log(email, 'deco', decodedEmail)
  if (email !== decodedEmail) {
    return res.status(403).send({ error: true, message: "Forbidden user" });
  }
  const query = {  email: email };
  const result = await enrollClassCollection.find(query).toArray();
  res.send(result);
  });


// get payment history by email 
app.get("/enrollClass/paymentHistory", verifyJWT, async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.send([]);
  }

  if (req.decoded.email !== email) {
    return res
      .status(403)
      .send({ error: true, message: "forbidden access" });
  }

  const query = { email: email };
  const sort = { date: -1 };
  const result = await enrollClassCollection.find(query).sort(sort).toArray();
  res.send(result);
});






//payment class related api-----------------------------




app.post("/paymentInfo",  async (req, res) => {
  const paymentInfo = req.body;
  const enrollInsertResult = await enrollClassCollection.insertOne(paymentInfo);

  const deleteQuery = {
    _id: new ObjectId(paymentInfo._id),
  };
  const deleteClassResult = await selectedClassesCollection.deleteOne(deleteQuery);

  const updateQuery = {
    _id: new ObjectId(paymentInfo.classId
      ),
  };
  const updateEnrolledStudentsResult = await classesCollection.updateOne(updateQuery, {
    $inc: { 
      enrolledStudents: 1 },
  });

  const updateAvailableSeatsQuery = {
    _id: new ObjectId(paymentInfo.classId),
  };
  const updateAvailableSeatsResult = await classesCollection.updateOne(
    updateAvailableSeatsQuery,
    {
      $inc: { 
        availableSeats: -1 },
    }
  );

  

  res.send({
    enrollInsertResult,
    deleteClassResult,
    updateEnrolledStudentsResult,
   updateAvailableSeatsResult,
    
  });
});



  // selected class related api-----------------------------


   // insert class in the selected class

   app.post("/selectedClass", async (req, res) => {
    const item = req.body;
    // console.log("adding new class: ", item);
    const result = await selectedClassesCollection.insertOne(item);
    res.send(result);
  });


  // get specific selected class data by email

  app.get("/selectedClass/all", verifyJWT, async (req, res) => {
    const email = req.query.email;
    const decodedEmail = req.decoded.email;
    // console.log(email, 'deco', decodedEmail)
    if (email !== decodedEmail) {
      return res.status(403).send({ error: true, message: "Forbidden user" });
    }
    const query = { studentEmail: email };
    const result = await selectedClassesCollection.find(query).toArray();
    res.send(result);
    });

 //delete selected class by id

  app.delete("/selectedClass/delete/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await selectedClassesCollection.deleteOne(query);
    res.send(result);
  });





  
    // user related api--------------------------

    // insert user data

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

   // get all user data  

   app.get("/users/all", verifyJWT, async (req, res) => {
    const email = req.query.email;
    const decodedEmail = req.decoded.email;
    // console.log(email, 'deco', decodedEmail)
    if (email !== decodedEmail) {
      return res.status(403).send({ error: true, message: "Forbidden user" });
    }
    const result = await usersCollection.find({}).toArray();
    res.send(result);
    });

      // update user roll by id

      app.patch("/users/:id",  async (req, res) => {
        const id = req.params.id;
        const updatedRoll = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: { role: updatedRoll.role}
        };
        const result = await usersCollection.updateOne(filter, updateDoc);

        res.send(result);
    });

   // get specific user data by role instructor

    app.get("/users/instructor",  async (req, res) => {
      
      const query = { role: "Instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });



    // get user role  is Admin / check is admin


    app.get("/users/isAdmin", verifyJWT, async (req, res) => { 
      const email = req.query.email;
 
      if (req.decoded.email !== email) { 
        res.send({ admin: false }); 
      } 
 
      const query = { email: email }; 
      const user = await usersCollection.findOne(query); 
      const result = { admin: user?.role === "Admin" }; 
      res.send(result); 
    })

// get user role  is Instructor / check is instructor

app.get("/users/isInstructor", verifyJWT, async (req, res) => { 
  const email = req.query.email;

  if (req.decoded.email !== email) { 
    res.send({instructor: false }); 
  } 

  const query = { email: email }; 
  const user = await usersCollection.findOne(query); 
  const result = { instructor: user?.role === "Instructor" }; 
  res.send(result); 
})

// get user role  is Student / check is student

app.get("/users/isStudent", verifyJWT, async (req, res) => { 
  const email = req.query.email;

  if (req.decoded.email !== email) { 
    res.send({ student: false }); 
  } 

  const query = { email: email }; 
  const user = await usersCollection.findOne(query); 
  const result = { student: user?.role === "student" }; 
  res.send(result); 
})


    // class related api----------------

    // insert class data

    app.post("/classes", verifyJWT, async (req, res) => {
      const classData = req.body;
      // console.log(classData);
      const result = await classesCollection.insertOne(classData);
      res.send(result);
    });

 // get all classes data  

    app.get("/classes/all", verifyJWT, async (req, res) => {
        const email = req.query.email;
        const decodedEmail = req.decoded.email;
        // console.log(email, 'deco', decodedEmail)
        if (email !== decodedEmail) {
          return res.status(403).send({ error: true, message: "Forbidden user" });
        }
        const result = await classesCollection.find({}).toArray();
        res.send(result);
        });

  // get popular classes data

  app.get("/classes/popularClasses", async (req, res) => {
    const query = { status: "Approve" };
    const options = { sort: { enrolledStudents: -1 } };
    const result = await classesCollection
      .find(query, options)
      .limit(6)
      .toArray();
    res.send(result);
  });


    
 // get specific class data by status = Approve

 app.get("/classes/approve",  async (req, res) => {
      
  const query = { status: "Approve" };
  const result = await classesCollection.find(query).toArray();
  res.send(result);
});




    // get specific classes  data by user email

    app.get("/classes", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      // console.log(email, 'deco', decodedEmail)
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Forbidden user" });
      }
      const query = { instructorEmail: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    // get single class data by id

    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    // update class status by id

    app.patch("/classes/:id",  async (req, res) => {
        const id = req.params.id;
        const updatedClass = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: { status: updatedClass.status}
        };
        const result = await classesCollection.updateOne(filter, updateDoc);

        res.send(result);
    });

// update class feedback by id

app.patch("/classes/feedback/:id",  async (req, res) => {
    const id = req.params.id;
    const updatedClass = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: { feedback: updatedClass.feedback }
    };
    const result = await classesCollection.updateOne(filter, updateDoc);

    res.send(result);
});


    // update class data by id

    app.put("/classes/:id", verifyJWT, async (req, res) => {
        const id = req.params.id;
        const updatedClass = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: updatedClass,
        };
      
        const result = await classesCollection.updateOne(filter, updateDoc, options);
      
        res.send(result);
      });
      

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
