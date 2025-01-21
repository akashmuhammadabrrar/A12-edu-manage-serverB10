const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("Inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // get all the classes API
    app.get("/classes", async (req, res) => {
      const result = await classCollectionTeacher.find().toArray();
      res.send(result);
    });
    // post class by teachers
    app.post("/classes", async (req, res) => {
      const classes = req.body;
      const result = await classCollectionTeacher.insertOne(classes);
      res.send(result);
    });

    // set approve and reject
    app.patch("/classes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approve",
        },
      };
      const result = await classCollectionTeacher.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // ret reject
    app.patch("/classes/reject/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedDocR = {
        $set: {
          status: "rejected",
        },
      };
      const result = await classCollectionTeacher.updateOne(
        filter,
        updatedDocR
      );
      res.send(result);
    });
    // select a specific class by id
    app.get("/classes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollectionTeacher.findOne(query);
      res.send(result);
      console.log(id);
    });

    // users related api
    // check the admin role
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      // get admin
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: "Forbidden access" });
      // }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.role === "admin";
      }
      res.send({ admin });
    });
    // check the teacher's role
    app.get("/teacher-req/teacher/:email", verifyToken, async (req, res) => {
      // get teacher
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: "Forbidden access" });
      // }
      const query = { email: email };
      const user = await teacherReqCollection.findOne(query);
      let teacher = false;
      if (user) {
        teacher = user.role === "teacher";
      }
      res.send({ teacher });
    });

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
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // make admin related api
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    // delete an user by id
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // teacher's req related api's
    app.post("/teacher-req", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await teacherReqCollection.insertOne(data);
      res.send(result);
    });
    // make a teacher api
    app.patch("/teacher-req/teacher/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "teacher",
        },
      };
      const result = await teacherReqCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/teacher-req", verifyToken, async (req, res) => {
      const result = await teacherReqCollection.find().toArray();
      res.send(result);
    });

    // payment related api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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
