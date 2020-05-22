const express = require('express');
const router = express.Router();

const init = async function(config) {
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

  return router;
};

module.exports = init;
