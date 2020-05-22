const express = require('express');
const router = express.Router();
const config = require('./config.json');

(async function() {
  let ga = null; // <- google_authを入れる
  // google_auth.googleClientを再利用するため
  router.set_google_auth = function(google_auth) {
    ga = google_auth;
  };

  router.get('/',(req,res)=>{
    res.render('register/register_top');
  });
  router.get('/google_sub_getter',(req,res)=>{
    res.render('register/google_sub_getter');
  });
  router.get('/yahoo_sub_getter',(req,res)=>{
    res.render('register/yahoo_sub_getter');
  });
})();

module.exports = router;
