const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c4n3e.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const classCollectionTeacher = client.db("EduManage").collection("classes");
    const usersCollection = client.db("EduManage").collection("users");
    const teacherReqCollection = client
      .db("EduManage")
      .collection("teacher-req");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body; // payload--> (user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10h",
      }); // payload,tokenSecret,exP.
      res.send({ token }); // send the token as an object
    });

    // get all the classes API
    app.get("/classes", async (req, res) => {
      const result = await classCollectionTeacher.find().toArray();
      res.send(result);
    });

    // users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      //   if user doesn't exits
      const query = { email: user?.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // make admin related api
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // delete an user by id
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // teacher's req related api's
    app.post("/teacher-req", async (req, res) => {
      const data = req.body;
      const result = await teacherReqCollection.insertOne(data);
      res.send(result);
    });

    app.get("/teacher-req", async (req, res) => {
      const result = await teacherReqCollection.find().toArray();
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

// root path
app.get("/", (req, res) => {
  res.send("Teacher And Admin Is Going...");
});

app.listen(port, () => {
  console.log(`Ed Manage Is Running On Port: ${port}`);
});
