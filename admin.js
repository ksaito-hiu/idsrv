const express = require('express');
const multer = require('multer');
const fs = require("fs").promises;
const path = require('path');

const router = express.Router();

const init = async function(config,clients,initial_users) {
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
    try {
      res.render('admin/user',{message:"none",userInfo:"none"});
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.post('/user',loginCheck,permissionCheck,async (req,res)=> {
    // 未実装
    try {
      let message = null;
      let userInfo = "none";
      if (!req.body.type) {
        // 通常ありえない
        message = 'req.body.type===null !?';
      } else if (req.body.type==='search') {
        let us = null;
        for (u of initial_users.users) {
          if (u.id===req.body.user_id) {
            us = [u];
            break;
          }
        }
        if (us) {
          message=`The user(id=${req.body.user_id}) was found.(Special User)`;
          userInfo = JSON.stringify(us[0],null,2);
        } else {
          us = await colUsers.find({id:req.body.user_id}).toArray();
          if (us.length===0) {
            message=`The user(id=${req.body.user_id}) was not found.`;
            userInfo=`The user(id=${req.body.user_id}) was not found.`;
          } else {
            message=`The user(id=${req.body.user_id}) was found.`;
            userInfo = JSON.stringify(us[0],null,2);
          }
        }
      } else if (req.body.type==='registration') {
        let us = null;
        for (u of initial_users.users) {
          if (u.id===req.body.user_id) {
            us = [u];
            break;
          }
        }
        if (us) {
          message = `A user_id=${req.body.user_id} is already used.`;
        } else {
          us = await colUsers.find({id:req.body.user_id}).toArray();
          if (us.length===0) {
            if (req.body.user_id==="") {
              message = 'The user_id should not be empty.';
            } else {
              const user = {
                id: req.body.user_id,
                googleId: req.body.google_sub,
                yahooId: req.body.yahoo_sub
              };
              message = 'A new user was registered.';
              userInfo = JSON.stringify(user,null,2);
              await colUsers.insertOne(user);
            }
          } else {
            message = `A user_id=${req.body.user_id} is already used.`;
          }
        }
      } else if (req.body.type==='deletion') {
        let us = null;
        for (u of initial_users.users) {
          if (u.id===req.body.user_id) {
            us = [u];
            break;
          }
        }
        if (us) {
          message = `A user_id=${req.body.user_id} is a Special User, and can not delete.`;
        } else {
          const r = await colUsers.deleteOne({id: req.body.user_id});
          if (r.deletedCount===1) {
            message = `A user(id=${req.body.user_id}) was deleted.`;
          } else {
            message = `A user(id=${req.body.user_id}) could not be deleted.`;
          }
        }
      } else {
        // 通常ありえない
        message = `req.body.type=${req.body.type}!?`;
      }
      res.render('admin/user',{message,userInfo});
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });

  router.get('/client',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const cs = [];
      // localクライアントは消せないように除外する
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local')
          continue;
        cs.push(clients.settings[i]);
      }
      const message = 'none.';
      res.render('admin/client',{message,"clients":cs});
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.post('/client',loginCheck,permissionCheck,async (req,res)=> {
    // まだ不完全
    // クライアント登録時にclient_idが空でないかのチェックとか、
    // その他色々。
    try {
      let message = null; // エラーがないかどうかのフラグにも使う

      if (!req.body.type) {
        // 通常ありえない
        message = 'req.body.type===null !?';
      } else if (req.body.type==='registration') {
        // 入力データーをクライアントメタデーターオブジェクトにする
        const client_id = req.body.client_id;
        const client_secret = req.body.client_secret;
        const redirect_uris = [];
        for (let r of req.body.redirects.split('\n')) {
          if (r==="") continue;
          redirect_uris.push(r.trim());
        }
        const post_logout_redirect_uris = [];
        for (let pr of req.body.post_redirects.split('\n')) {
          if (pr==="") continue;
          post_logout_redirect_uris.push(pr.trim());
        }
        const new_client = {client_id,client_secret,redirect_uris,post_logout_redirect_uris};

        // client_idが'local'でないことのチェック
        if (new_client.client_id==='local') {
          message = `The client_id should not be 'local'.`;
        }

        // client_idの重複チェック
        for (c of clients.settings) {
          if (c.client_id === new_client.client_id) {
            message = `The client (id=${client_id}) is already registered.`;
            break;
          }
        }
        // エラーが無ければ登録
        if (message===null) {
          clients.settings.push(new_client);
          await fs.writeFile(path.join(__dirname,'clients.json'),JSON.stringify(clients,null,2));
          message=`The client(cliet_id=${client_id} was registered.`;
        }
      } else if (req.body.type==='deletion') {
        const client_id = req.body.client_id;
        // 通常ありえないけどclient_idが'local'でないことのチェック
        if (client_id==='local') {
          message = `The client_id===local should not be deleted.`;
        }
        // エラーが無ければ消去
        if (message===null) {
          for (let i=0;i<clients.settings.length;i++) {
            if (clients.settings[i].client_id===client_id) {
              clients.settings.splice(i,1);
              break;
            }
          }
          await fs.writeFile(path.join(__dirname,'clients.json'),JSON.stringify(clients,null,2));
          message=`The client(cliet_id=${client_id} was deleted.`;
        }
      } else {
        // 通常ありえない
        message = `req.body.type=${req.body.type}!?`;
      }
      
      const cs = [];
      // localクライアントは消せないように除外する
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local')
          continue;
        cs.push(clients.settings[i]);
      }
      res.render('admin/client',{message,"clients":cs});
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });

  return router;
};

module.exports = init;
