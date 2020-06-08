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
      const o = {};
      o.message = "none";
      o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
      res.render('admin/user',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.get('/user_search',loginCheck,permissionCheck,async (req,res)=> {
    try {
      let o = {}; // 'admin/user.ejs'にわたすデーター
      let us = null;
      for (u of initial_users.users) {
        if (u.id===req.query.user_id) {
          us = [u];
          break;
        }
      }
      if (us) {
        o.message=`The user(id=${req.query.user_id}) was found.(Special User)`;
        o.uid = us[0].id;
        o.google_sub = us[0].googleId;
        o.yahoo_sub = us[0].yahooId;
        o.pub_mod = us[0].pub_mod;
        o.pub_exp = us[0].pub_exp;
      } else {
        us = await colUsers.find({id:req.query.user_id}).toArray();
        if (us.length===0) {
          o.message=`The user(id=${req.query.user_id}) was not found.`;
          o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
        } else {
          o.message=`The user(id=${req.query.user_id}) was found.`;
          o.uid = us[0].id;
          o.google_sub = us[0].googleId;
          o.yahoo_sub = us[0].yahooId;
          o.pub_mod = us[0].pub_mod;
          o.pub_exp = us[0].pub_exp;
        }
      }
      res.render('admin/user',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.get('/user_del',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const user_id = req.query.user_id;
      let o = {}; // 'admin/user.ejs'にわたすデーター
      let us = null;
      for (const u of initial_users.users) {
        if (u.id===user_id) {
          us = [u];
          break;
        }
      }
      if (us) {
        o.message = `A user_id=${user_id} is a Special User, and can not delete.`;
        o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
      } else {
        const r = await colUsers.deleteOne({id: user_id});
        if (r.deletedCount===1) {
          o.message = `A user(id=${user_id}) was deleted.`;
          o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
        } else {
          o.message = `A user(id=${user_id}) could not be deleted.`;
          o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
        }
      }
      res.render('admin/user',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.get('/user_add',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const user_id = req.query.user_id;
      const google_sub = req.query.google_sub;
      const yahoo_sub = req.query.yahoo_sub;
      const pub_mod = req.query.pub_mod;
      const pub_exp = req.query.pub_exp;
      let o = {}; // 'admin/user.ejs'にわたすデーター
      if (!user_id) {
        o.message = 'The user_id should not be empty.';
        o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
        res.render('admin/user',o);
        return;
      }
      let us = null;
      for (u of initial_users.users) {
        if (u.id===user_id) {
          us = [u];
          break;
        }
      }
      if (us) {
        o.message = `A user_id=${user_id} is a special user. And can not edit.`;
        o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
        res.render('admin/user',o);
        return;
      }
      const user_data = {
        googleId: google_sub,
        yahooId: yahoo_sub,
        pub_mod: pub_mod,
        pub_exp: pub_exp
      };
      const r = await colUsers.updateOne({id: user_id},{$set: user_data},{upsert:true});
      o.message = 'A user was registered.';
      o.uid=o.google_sub=o.yahoo_sub=o.pub_mod=o.pub_exp='';
      res.render('admin/user',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });

  router.get('/client',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const o = {};
      o.message = 'none.';
      o.client_id=o.secret=o.redirects=o.post_redirects='';
      const cs = [];
      // localクライアントは消せないように除外する
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local')
          continue;
        cs.push(clients.settings[i]);
      }
      o.clients = cs;
      res.render('admin/client',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.get('/client_search',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const o = {};
      o.message = null; // エラーがないかどうかのフラグにも使う
      for (const c of clients.settings) {
        if (c.client_id===req.query.client_id) {
          o.message=`The client(id=${c.client_id}) was found.`;
          o.client_id=c.client_id;
          o.secret=c.client_secret;
          o.redirects=c.redirect_uris.join('\n');
          o.post_redirects=c.post_logout_redirect_uris.join('\n');
          break;
        }
      }
      if (!o.message) {
        o.message=`The client(id=${c.client_id}) was not found.`;
        o.client_id=o.secret=o.redirects=o.post_redirects='';
      }
      const cs = [];
      // localクライアントは消せないように除外する
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local')
          continue;
        cs.push(clients.settings[i]);
      }
      o.clients = cs;
      res.render('admin/client',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.get('/client_del',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const client_id = req.query.client_id;
      let o = {}; // 'admin/client.ejs'にわたすデーター
      if (!client_id) {
        o.message = `The client_id must be specified.`;
        o.client_id=o.secret=o.redirects=o.post_redirects='';
      } else if (client_id==='local') {
        o.message = `The client_id===local should not be deleted.`;
        o.client_id=o.secret=o.redirects=o.post_redirects='';
      } else { // エラーが無ければ消去
        for (let i=0;i<clients.settings.length;i++) {
          if (clients.settings[i].client_id===client_id) {
            clients.settings.splice(i,1);
            break;
          }
        }
        await fs.writeFile(path.join(__dirname,'clients.json'),JSON.stringify(clients,null,2));
        o.message=`The client(cliet_id=${client_id} was deleted.`;
        o.client_id=o.secret=o.redirects=o.post_redirects='';
      }
      const cs = [];
      // localクライアントは消せないように除外する
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local')
          continue;
        cs.push(clients.settings[i]);
      }
      o.clients = cs;
      res.render('admin/client',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });
  router.get('/client_add',loginCheck,permissionCheck,async (req,res)=> {
    try {
      const client_id = req.query.client_id;
      const o = {}; // 'admin/client.ejs'にわたすデーター
      if (!client_id) {
        o.message = `The client_id must be specified.`;
        o.client_id=o.secret=o.redirects=o.post_redirects='';
      } else if (client_id==='local') {
        o.message = 'The client_id should not be "local".';
        o.client_id=o.secret=o.redirects=o.post_redirects='';
      } else {
        // 入力データーをクライアントメタデーターオブジェクトにする
        const client_secret = req.query.secret;
        const redirect_uris = [];
        for (let r of req.query.redirects.split('\n')) {
          if (r==="") continue;
          redirect_uris.push(r.trim());
        }
        const post_logout_redirect_uris = [];
        for (let pr of req.query.post_redirects.split('\n')) {
          if (pr==="") continue;
          post_logout_redirect_uris.push(pr.trim());
        }
        const new_client = {client_id,client_secret,redirect_uris,post_logout_redirect_uris};
        // 同じclient_idの古いデーターは消す
        for (let i=0;i<clients.settings.length;i++) {
          if (clients.settings[i].client_id===client_id) {
            clients.settings.splice(i,1);
            break;
          }
        }
        clients.settings.push(new_client);
        await fs.writeFile(path.join(__dirname,'clients.json'),JSON.stringify(clients,null,2));
        o.message=`The client(cliet_id=${client_id} was registered.`;
        o.client_id=o.secret=o.redirects=o.post_redirects='';
      }
      // client_idのリストを作る
      // localクライアントは消したりできないように除外する
      const cs = [];
      for (let i=0;i<clients.settings.length;i++) {
        if (clients.settings[i].client_id === 'local')
          continue;
        cs.push(clients.settings[i]);
      }
      o.clients = cs;
      res.render('admin/client',o);
    } catch(err) {
      res.render('error.ejs',{message:err.toString()});
    }
  });

  return router;
};

module.exports = init;
