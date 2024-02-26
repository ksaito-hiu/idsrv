import express from 'express';
const router = express.Router();
import { generators } from 'openid-client';

const init = async function(config) {
  let ga = null; // <- google_authを入れる
  let ya = null; // <- yahoo_authを入れる
  let colUsers = null; // <- MongoDBにユーザー情報入れるためのcollection



  // 以下のコールバックURLもうちょっと上手く設定されるようにしないと。GAHA
  const g_callback = `https://${config.server.hostname}/register/g_callback`;
  const y_callback = `https://${config.server.hostname}/register/y_callback`;
  //const g_callback = `http://localhost:8080/register/g_callback`;
  //const y_callback = `http://localhost:8080/register/y_callback`;



  // ログインチェック AND uid取得
  function loginCheck(req,res,next) {
    let webid = null;
    if (!!req.session && !!req.session.webid)
      webid = req.session.webid;
    if (!webid) {
      const loginURL = config.server.mount_path+'/auth/login?return_path='+config.server.mount_path+req.originalUrl;
      res.redirect(loginURL);
      return;
    }
    // WebIDからuidを切り出してセッションに保存
    req.session.uid = config.server.webid2id(webid);
    next();
  }

  // google_auth.googleClientを再利用するため
  router.set_google_auth = function(google_auth) {
    ga = google_auth;
  };
  // google_auth.googleClientを再利用するため
  router.set_yahoo_auth = function(yahoo_auth) {
    ya = yahoo_auth;
  };
  // MongoDBのクライアントを受け取ってDBと接続し、
  // ユーザー情報を保存するためのコレクションを確保
  router.setMongoClient = function(mongoClient) {
    // DBの名前はidsrvで、col名はusersということで決め打ち
    colUsers = mongoClient.db('idsrv').collection('users');
  };

  // ***** google認証を利用してユーザーを自動登録するための仕組み *****
  router.get('/google_login',(req,res)=>{
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);

    req.session.code_verifier = code_verifier;

    const params = {
      redirect_uri: g_callback,
      scope: 'openid email',
      code_challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account' // 2021,07/24: 自動的にログインしないように追加
    };
    const goToUrl = ga.googleClient.authorizationUrl(params);
    res.redirect(goToUrl);
  });
  router.get('/g_callback', async (req,res) => {
    var params = ga.googleClient.callbackParams(req);

    var code_verifier = req.session.code_verifier;

    try {
      const tokenSet = await ga.googleClient.callback(g_callback, params, { code_verifier });
      const sub = tokenSet.claims().sub;
      const userinfo = await ga.googleClient.userinfo(tokenSet.access_token);
      const email = userinfo.email;
      const email_verified = userinfo.email_verified;
      if (!email_verified) {
        res.render('error',{message:"Your email is not verified by google."});
        return;
      }
      const id = config.server.email2id(email);
      if (!id) {
        res.render('error',{message:"You can not use this auto register method. Ask your admin."});
        return;
      }
      const as = colUsers.find({"id":id}).toArray();
      if (as.length>0) {
        res.render('error',{message:`You had already registerd as ${id}.`});
        return;
      }
      colUsers.insertOne({"id":id,googleId:sub});
      req.session.webid = config.server.id2webid(id);
      req.session.uid = id;
      res.render('message',{message:"You are registerd! google sub="+sub+", id="+id+", email="+email+" ."});
    } catch(err) {
      res.render('error',{message:"error="+err+"."});
    }
  });

  // ***** yahoo認証を利用してログインできるように自分で設定するための仕組み *****
  router.get('/yahoo_login',(req,res)=>{
    //まずはログインチェック
    let webid = null;
    if (!!req.session && !!req.session.webid)
      webid = req.session.webid;
    if (!webid) {
      res.render('error',{message:"You have to login first."});
      return;
    }
    // WebIDからuidを切り出す
    let uid = config.server.webid2id(webid);
    if (!uid) {
      res.render('error',{message:"Strange! You are not a valid user.(1)"});
      return;
    }

    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);

    req.session.code_verifier = code_verifier;

    const params = {
      redirect_uri: y_callback,
      scope: 'openid',
      code_challenge,
      code_challenge_method: 'S256'
    };
    const goToUrl = ya.yahooClient.authorizationUrl(params);
    res.redirect(goToUrl);
  });
  router.get('/y_callback', async (req,res) => {
    //ここでもログインチェックをする
    let webid = null;
    if (!!req.session && !!req.session.webid)
      webid = req.session.webid;
    if (!webid) {
      res.render('error',{message:"You have to login first."});
      return;
    }
    // WebIDからuidを切り出す
    let uid = config.server.webid2id(webid);
    if (!uid) {
      res.render('error',{message:"Strange! You are not a valid user.(2)"});
      return;
    }

    var params = ya.yahooClient.callbackParams(req);

    var code_verifier = req.session.code_verifier;

    try {
      const tokenSet = await ya.yahooClient.callback(y_callback, params, { code_verifier });
      const sub = tokenSet.claims().sub;
      const r = await colUsers.findOneAndUpdate({id:uid},{$set: {yahooId:sub}},{
        returnOriginal: false,
        upsert: false
      });
      if (r.value.yahooId !== sub) {
        res.render('error',{message:"Strange! Your data could not be found on DB."});
        return;
      }
      res.render('message',{message:"Your yahoo id is registered. sub="+sub+", uid="+uid+" ."});
    } catch(err) {
      res.render('error',{message:"error="+err+"."});
    }
  });

  // googleのsubを調べるためだけのimplicit flowなクライアント
  router.get('/google_sub_getter',(req,res)=>{
    res.render('register/google_sub_getter');
  });
  // yahooのsubを調べるためだけのimplicit flowなクライアント
  router.get('/yahoo_sub_getter',(req,res)=>{
    res.render('register/yahoo_sub_getter');
  });

  router.get('/',(req,res)=>{
    res.render('register/register_top');
  });

  return router;
};

export default init;
