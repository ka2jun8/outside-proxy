import { ExpressServer } from "./express";
require("dotenv").config();

const port: number = Number(process.env.PORT) || 8080;
const express = new ExpressServer(port);

process.on("SIGINT", function () {
  console.log("shutting down from SIGINT (Ctrl+C)");
  process.exit();
});
