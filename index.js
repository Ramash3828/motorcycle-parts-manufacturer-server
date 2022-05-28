const express = require("express");
const app = express();
const cors = require("cors");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(
    "sk_test_51L3ESPBIdT4KTE6Fnzj9Zj6tx1wCT1nW50GcHaIKsjOTSZ83SapmEZ5oxUmBcjnmY6vgFd9FJaE0JK3rdBgNX8TA00CSs3m78b"
);

//Middleware
app.use(express.json());
app.use(cors());
//Send Email

function sendBookingEmail(product) {
    var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_SENDER,
            pass: process.env.EMAIL_PASS_KEY,
        },
    });

    var mailOptions = {
        from: process.env.EMAIL_SENDER,
        to: `${product?.email}`,
        subject: `Your Booking for ${product.name} and amount $${product.grandTotal} is confirmed`,
        text: `Your Booking for ${product.name} and amount $${product.grandTotal} is confirmed`,
        html: `
           <div>
                <div>
                    <p>
                        Hello ${product.userName}
                    </p>
                    <p>
                        Address : ${product.address}
                    </p>
                    <p>
                        Phone : ${product.phone}
                    </p>
                    <p >
                        Please Pay for :${product.name} product.
                    </p>
                    <p>
                        Your order quantity is ${product?.order} and price per product $${product.price} <strong>Total amount: </strong> $${product.grandTotal}
                    </p>
                    <p>
                        Please pay your amount: $${product?.grandTotal}
                    </p>
                </div>
            </div>
            `,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log("Email sent: " + info?.response);
        }
    });
}

// end send email
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqxor.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});

// Verify Access Token
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorize access" });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
    });
};

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
        const paymentCollection = client
            .db("parts-manufacturer")
            .collection("payments");

        // Admin Verify
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({
                email: requester,
            });
            if (requesterAccount.role === "admin") {
                next();
            } else {
                res.status(403).send({ message: "forbidden" });
            }
        };

        // Make Admin and update database
        app.put(
            "/user/admin/:email",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
                const email = req.params.email;
                const requseter = req.decoded.email;

                const requesterAccount = await userCollection.findOne({
                    email: requseter,
                });
                if (requesterAccount.role === "admin") {
                    const filter = { email: email };
                    const updateDoc = {
                        $set: { role: "admin" },
                    };
                    const result = await userCollection.updateOne(
                        filter,
                        updateDoc
                    );
                    res.send(result);
                } else {
                    res.status(403).send({ message: "Forbidden access" });
                }
            }
        );

        // User create and update in database do not verify
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
                expiresIn: "1d",
            });
            res.send({ result, token });
        });

        // Get all user
        app.get("/users", verifyToken, async (req, res) => {
            const cursor = userCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
        });
        // Add Products
        app.post("/add-product", verifyToken, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });
        app.put(
            "/update-product/:id",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
                const product = req.body;
                const { id } = req.params;
                const filter = { _id: ObjectId(id) };
                const options = { upsert: true };

                const updateDoc = {
                    $set: product,
                };
                const result = await productCollection.updateOne(
                    filter,
                    updateDoc,
                    options
                );
                res.send({
                    result: result,
                    message: "Update data successfully",
                });
            }
        );
        // Order Insert
        app.post("/add-order", verifyToken, async (req, res) => {
            const order = req.body;

            const result = await orderCollection.insertOne(order);
            sendBookingEmail(order);
            return res.send({
                result: result,
                message: "Successful Order",
            });
        });

        // My Booking Orders
        app.get("/my-orders/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await (
                await orderCollection.find(filter).toArray()
            ).reverse();

            res.send(result);
        });
        // Get All orders
        app.get("/all-orders", verifyToken, async (req, res) => {
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

        // Update Product
        app.put("/update-product/:id", verifyToken, async (req, res) => {
            const product = req.body;
            const { id } = req.params;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: product,
            };
            const result = await reviewCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            res.send({ review: result, message: "Sent Product successfully" });
        });

        // Delete a Product
        app.delete("/product-delete/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(filter);
            res.send({
                message: "Order cancel Successfully! ",
            });
        });

        // Review Add
        app.put("/add-review/:id", verifyToken, async (req, res) => {
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

        // Get Review
        app.get("/review/", async (req, res) => {
            const review = await (
                await reviewCollection.find({}).toArray()
            ).reverse();

            res.send(review);
        });

        // Payment gateway
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_methods_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.patch("/booking/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                },
            };

            const result = await paymentCollection.insertOne(payment);
            // const updatedBooking = await orderCollection.updateOne(
            //     filter,
            //     updatedDoc
            // );
            res.send(updatedBooking);
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
