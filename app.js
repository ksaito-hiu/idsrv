var express = require("express");
var app = express();
var fs = require('fs');
var https = require('https');
var options = {
    key:  fs.readFileSync('/etc/letsencrypt/live/id.do-johodai.ac.jp/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/id.do-johodai.ac.jp/fullchain.pem')
};
var server = https.createServer(options,app);

app.get("/", (req, res) => {
    res.status(200).send("Hello World");
});

server.listen(8080,()=>{console.log('start')});
