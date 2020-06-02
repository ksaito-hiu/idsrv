const express = require('express');
const multer = require('multer');
const fs = require("fs").promises;
const path = require('path');

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

  router.get('/user',loginCheck,permissionCheck,async (req,res)=> {
    // 未実装
    try {
      res.render('admin/user');
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.post('/user',loginCheck,permissionCheck,async (req,res)=> {
    // 未実装
    try {
      res.render('admin/user');
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });

  router.get('/client',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const buff = await fs.readFile(path.join(__dirname,'clients.json'),"utf-8");
      const clients = JSON.parse(buff);
      // localクライアントは消せないように除外する
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local') {
          clients.settings.splice(i,1);
          break;
        }
      }
      res.render('admin/client',{"clients":clients});
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.post('/client',loginCheck,permissionCheck,async (req,res)=> {
    // 未実装
    // localというIDのクライアントは特別扱いしないといけないことを忘れないこと
    // あと当然client_idが被ったりしないように気をつけるべし。
    try {
      const buff = await fs.readFile(path.join(__dirname,'clients.json'),"utf-8");
      const clients = JSON.parse(buff);
      // localクライアントは消せないように除外する
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local') {
          clients.settings.splice(i,1);
          break;
        }
      }
      res.render('admin/client',{clients});
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });

  return router;
};

module.exports = init;
