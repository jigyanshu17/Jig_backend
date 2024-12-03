
// require('dotenv').config({path: './env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import {app} from './app.js'
dotenv.config({
    path: './.env'
})



connectDB()
.then(() => {
   app.listen(process.env.PORT || 8000, () => {
     const port = process.env.PORT || 8000;
     const localHostLink = `http://localhost:${port}`;
     console.log(`⚙️ Server is running at port: ${port}`);
     console.log(`🌐 Local host link: ${localHostLink}`);
   });
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})