const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://edmanage-auth.web.app"],
  })
);
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
    // await client.connect();

    const classCollectionTeacher = client.db("EduManage").collection("classes");
    const usersCollection = client.db("EduManage").collection("users");
    const teacherReqCollection = client
      .db("EduManage")
      .collection("teacher-req");
    const paymentsCollection = client.db("EduManage").collection("payments");
    const feedbackCollection = client.db("EduManage").collection("feedbacks");

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
      // console.log("Inside verify token", req.headers.authorization);
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
    app.post("/classes", verifyToken, async (req, res) => {
      const classes = req.body;
      const result = await classCollectionTeacher.insertOne(classes);
      res.send(result);
    });
    // post feedback data
    app.post("/feedback", async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    });
    // get feedback data
    app.get("/feedback", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });

    // set approve and reject
    app.patch("/classes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approve",
        },
      };
      const result = await classCollectionTeacher.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Set up a new route to handle assignment creation
    app.patch("/classes/:id/assignments", verifyToken, async (req, res) => {
      const id = req.params.id;
      const assignmentData = req.body; // Get assignment data from request body

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          assignments: assignmentData, // Store the assignment data
        },
      };

      try {
        const result = await classCollectionTeacher.updateOne(
          filter,
          updateDoc
        );

        if (result.modifiedCount === 0) {
          throw new Error(
            "No documents matched the query. Updated 0 documents."
          );
        }

        res.status(200).json({
          status: "success",
          message: "Assignment updated successfully",
          data: assignmentData,
        });
      } catch (error) {
        console.error("Error updating assignment:", error);
        res.status(500).json({
          status: "error",
          message: "An error occurred while updating the assignment",
          error: error.message,
        });
      }
    });

    // ret reject
    app.patch(
      "/classes/reject/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id);
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
      }
    );
    // select a specific class by id
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollectionTeacher.findOne(query);
      res.send(result);
      // console.log(id);
    });
    app.get("/classes/teacher/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classCollectionTeacher.find(query).toArray();
      res.send(result);
      console.log(email);
    });
    // update the added class by a teacher
    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateClass = req.body;
      const updatedDoc = {
        $set: {
          image: updateClass.image,
          price: updateClass.price,
          title: updateClass.title,
          description: updateClass.description,
        },
      };
      // console.log(updatedDoc);
      const result = await classCollectionTeacher.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    // delete a class
    app.delete("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollectionTeacher.deleteOne(query);
      res.send(result);
    });

    // users related api
    // check the admin role
    app.get("/users/admin/:email", async (req, res) => {
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
    app.get("/teacher-req/teacher/:email", async (req, res) => {
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
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/api/user-count", async (req, res) => {
      const count = await usersCollection.countDocuments();
      res.send({ count });
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
    // app.post("/create-payment-intent/:id", async (req, res) => {
    //   const { price } = req.body;
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const TeacherClass = await classCollectionTeacher.findOne(query);

    //   const amount = parseInt(price * 100);
    //   console.log(amount, "amount inside the intent");

    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: amount,
    //     currency: "usd",
    //     payment_method_types: ["card"],
    //   });
    //   const updatedDoc = {
    //     $set: {
    //       enrollment: enrollment + 1,
    //     },
    //   };
    //   const updEnrRes = await classCollectionTeacher.updateOne(query,updatedDoc)
    //   res.send({
    //     clientSecret: paymentIntent.client_secret,
    //   });
    // });

    app.post("/create-payment-intent/:id", async (req, res) => {
      try {
        const { price } = req.body; // Get price from request body
        const id = req.params.id; // Get class ID from URL params
        const query = { _id: new ObjectId(id) };

        const TeacherClass = await classCollectionTeacher.findOne(query);
        if (!TeacherClass) {
          return res.status(404).send({ error: "Class not found" });
        }
        const amount = parseInt(price * 100);
        // console.log(amount, "amount inside the intent");

        // Create the payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        const updatedDoc = {
          $set: {
            enroll: (TeacherClass.enroll || 0) + 1, // If enroll doesn't exist, start from 0
          },
        };
        const updRes = await classCollectionTeacher.updateOne(
          query,
          updatedDoc
        );
        if (updRes.modifiedCount === 0) {
          return res
            .status(500)
            .send({ error: "Failed to update enrollment count" });
        }
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        // console.error("Error in /create-payment-intent:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // payment
    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const payResult = await paymentsCollection.insertOne(payment);
      // console.log("payment info", payment);
      res.send(payResult);
    });

    // get class inside the payment data
    app.get("/enrollments", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      try {
        const enrollments = await paymentsCollection.find({ email }).toArray();
        res.send(enrollments);
      } catch (error) {
        res.status(500).send({ message: "Error fetching enrollments", error });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
