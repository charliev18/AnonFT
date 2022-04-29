const express=require("express");
const web3 = require("web3");
const ethjs = require("ethjs");
const app = express();

app.use(express.static("./"));

app.listen(8080,function(){console.log("listening on port 8080");});
