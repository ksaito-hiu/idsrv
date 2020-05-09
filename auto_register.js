const express = require('express');
const router = express.Router();
const config = require('./config.json');

(async function() {
    router.get('/',(req,res)=>{
        res.render('OP/auto_register');
    });
    router.get('/google_sub_getter',(req,res)=>{
        res.render('OP/google_sub_getter');
    });
    router.get('/yahoo_sub_getter',(req,res)=>{
        res.render('OP/yahoo_sub_getter');
    });
})();

module.exports = router;
