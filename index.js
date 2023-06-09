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
    await client.connect();

    const usersCollection = client.db("eliteSports").collection("users");
    const classesCollection = client.db("eliteSports").collection("classes");

    // user related api-------------

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

    // create jwt token

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

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


    




    // get all classes  data by user email

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
