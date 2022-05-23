const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");

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
        // User create and update in database
        app.put("/add-user/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body;
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

        // Add Product
        app.get("/get-product", async (req, res) => {
            const result = await productCollection.find({}).toArray();
            res.send(result);
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
