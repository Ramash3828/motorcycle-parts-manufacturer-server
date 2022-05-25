const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqxor.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});
async function run() {
    try {
        await client.connect();
        const productCollection = client
            .db("parts-manufacturer")
            .collection("products");
        const userCollection = client
            .db("parts-manufacturer")
            .collection("users");
        const orderCollection = client
            .db("parts-manufacturer")
            .collection("orders");
        const reviewCollection = client
            .db("parts-manufacturer")
            .collection("reviews");

        // User create and update in database
        app.put("/add-user/:email", async (req, res) => {
            const email = req?.params.email;
            const user = req?.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, {
                expiresIn: "1h",
            });
            res.send({ result, token });
        });
        // Add Products
        app.post("/add-product", async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        // Order
        app.post("/add-order", async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send({ result: result, message: "Successful Order" });
        });

        // My Booking Orders
        app.get("/my-orders/:email", async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await (
                await orderCollection.find(filter).toArray()
            ).reverse();

            res.send(result);
        });
        // Get All orders
        app.get("/all-orders", async (req, res) => {
            const result = await (
                await orderCollection.find({}).toArray()
            ).reverse();
            res.send(result);
        });
        // Delete order
        app.delete("/delete-orders/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send({
                message: "Order cancel Successfully! ",
            });
        });
        // Add Product
        app.get("/get-product", async (req, res) => {
            const result = await (
                await productCollection.find({}).limit(6).toArray()
            ).reverse();
            res.send(result);
        });
        // Review Add
        app.put("/add-review/:id", async (req, res) => {
            const review = req.body;
            const { id } = req.params;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: review,
            };
            const result = await reviewCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            res.send({ review: result, message: "Sent Review successfully" });
        });

        // Get Review Count
        app.get("/add-review/", async (req, res) => {
            const result = await (
                await reviewCollection.find({}).toArray()
            ).reverse();
            res.send(result);
        });

        // Payment gateway
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe?.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_methods_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
    } finally {
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("WelCome Motorcycle Parts Manufacturer");
});
app.listen(port, () => {
    console.log(`Running port ${port}`);
});
