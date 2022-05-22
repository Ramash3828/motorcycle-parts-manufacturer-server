const express = require("express");
const app = express();
const cors = require("cors");
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
        const productcollection = client
            .db("parts-manufacturer")
            .collection("products");

        app.get("/add-product", async (req, res) => {
            const result = await productcollection.find({}).toArray();
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
