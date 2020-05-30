const express = require('express');
const multer = require('multer');

const router = express.Router();

const init = async function(config) {
  let colUsers = null;

  // MongoDBのクライアントを受け取ってDBを取得し、
  // usersを記録するためのcollectionを取得。
  // DBは'idsrv'の決め打ち
  router.set_mongo_client = async function(mc) {
    const db = mc.db('idsrv');
    colUsers = await db.collection('users');
  };

  const storage = multer.memoryStorage();
  const upload = multer({storage: storage});

  // ログインチェック
  function loginCheck(req,res,next) {
    if (!req.session) {
      res.render('message',{message:"You have to login."});
      return;
    }
    if (!req.session.webid) {
      res.render('message',{message:"You have to login."});
      return;
    }
    next();
  }

  // アクセス件チェック
  // 上のloginCheckの後で呼ばれることを前提にしてる
  // のでreq.session.webidにwebidが入って
  // いる前提で処理している。
  function permissionCheck(req,res,next) {
    if (!config.admin.includes(req.session.webid)) {
      res.render('message',{message:"You don't have permission."});
      return;
    }
    next();
  }

  router.get('/',loginCheck,permissionCheck,(req,res)=>{
    res.render('admin/admin_top');
  });

  router.get('/backup',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const us = await colUsers.find({}).toArray();
      res.json({"users":us});
    } catch(err) {
      res.json({ "err": err.toString()});
    }
  });

  router.post('/restore',loginCheck,permissionCheck,upload.single('usersFile'),async (req,res)=> {
    try {
      const usersFile = req.file || null;
      if (usersFile) {
        const data = usersFile.buffer.toString();
        const usersObj = JSON.parse(data);
        await colUsers.deleteMany({});
        await colUsers.insertMany(usersObj.users);
        res.render('message',{message:"Users data are restored."});
      } else {
        res.render('error.ejs',{message:"The file did not uploaded."});
      }
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });

  return router;
};

module.exports = init;
