const express = require('express');
const router = express.Router();
const { generators } = require('openid-client');





// 以下のコールバックURLなんとかして自動で上手く設定されるようにしないと
const g_callback = 'https://id.do-johodai.ac.jp/register/g_callback';
const y_callback = 'https://id.do-johodai.ac.jp/register/y_callback';




const init = async function(config) {
  let ga = null; // <- google_authを入れる
  let ya = null; // <- yahoo_authを入れる

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
    // 以下情報大のWebIDの付け方に依存
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

  // ***** google認証を利用してユーザーを自動登録するための仕組み *****
  router.get('/google_login',(req,res)=>{
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);

    req.session.code_verifier = code_verifier;

    const params = {
      redirect_uri: g_callback,
      scope: 'openid email',
      code_challenge,
      code_challenge_method: 'S256'
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
        res.render('error',{message:"Your can not use this auto register method. Ask your admin."});
        return;
      }
      res.render('message',{message:"google sub="+sub+", id="+id+", email="+email+" ."});
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
    // 以下情報大のWebIDの付け方に依存
    let uid = webid.match(/^https:\/\/id.do-johodai.ac.jp\/people\/(.*)#me$/)[1];
    if (!uid) {
      res.render('error',{message:"Strange! You are not a HIU member."});
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
    // 以下情報大のWebIDの付け方に依存
    let uid = webid.match(/^https:\/\/id.do-johodai.ac.jp\/people\/(.*)#me$/)[1];
    if (!uid) {
      res.render('error',{message:"Strange! You are not a HIU member."});
      return;
    }

    var params = ya.yahooClient.callbackParams(req);

    var code_verifier = req.session.code_verifier;

    try {
      const tokenSet = await ya.yahooClient.callback(y_callback, params, { code_verifier });
      const sub = tokenSet.claims().sub;
      res.render('message',{message:"yahoo sub="+sub+", uid="+uid+" ."});
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

module.exports = init;
