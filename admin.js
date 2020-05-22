const express = require('express');
const router = express.Router();
const config = require('./config.json');

(async function() {
  router.get('/',(req,res)=>{
    if (!req.session) {
      res.render('message',{message:"You have to login."});
      return;
    }
    if (!req.session.webid) {
      res.render('message',{message:"You have to login."});
      return;
    }
    if (config.admin.includes(req.session.webid)) {
      res.render('admin/admin_top');
    } else {
      res.render('message',{message:"You don't have permission."});
    }
  });
})();

module.exports = router;
