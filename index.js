import express from "express";
import TransactionRouter from "./router/transaction.js";
import * as dotenv from "dotenv";


dotenv.config();

const app = express();


app.use(express.json());
app.use("/api/v1/transaction", TransactionRouter);

app.get("/", (req, res) => {
    res.send("Hello World!");
});


app.listen(5000, () => {
    console.log("Server started on port 5000");
});