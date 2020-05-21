const express = require('express');
const router = express.Router();
const config = require('./config.json');

(async function() {
  let google_auth = null;
  router.get('/',(req,res)=>{
    res.render('OP/auto_register');
  });
  router.get('/google_sub_getter',(req,res)=>{
    res.render('OP/google_sub_getter');
  });
  router.get('/yahoo_sub_getter',(req,res)=>{
    res.render('OP/yahoo_sub_getter');
  });

  // google_auth.googleClientを再利用するため
  router.set_google_auth = function(ga) {
    google_auth = ga;
  };
})();

module.exports = router;
