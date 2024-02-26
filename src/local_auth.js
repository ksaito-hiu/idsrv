import express from 'express';
const router = express.Router();
import { Issuer, generators } from 'openid-client';

const init = async function(config,initial_users,logout_redirect) {
  let tryCount = 0;
  let localClient;
  let colUsers = null;

  // MongoDBのクライアントを受け取ってDBを取得し、
  // usersを記録するためのcollectionを取得。
  // DBは'idsrv'の決め打ち
  router.set_mongo_client = async function(mc) {
    const db = mc.db('idsrv');
    colUsers = await db.collection('users');
  };

  const initLocalClient = async function() {
    try {
      const issuer = await Issuer.discover(config.localAPI.issuer);
      //console.log('Discovered issuer %s %O',
      //            issuer.issuer,issuer.metadata)
      localClient = new issuer.Client({
        client_id: config.localAPI.client_id,
        client_secret: config.localAPI.client_secret,
        redirect_uris: config.localAPI.redirect_uris,
        response_types: ['code'],
        // id_token_signed_response_alg (default "RS256")
        // token_endpoint_auth_method (default "client_secret_basic")
      });
      console.log('The local client is ready.');
    } catch(err) {
      console.log('Cannot search local openid-op. (tryCount='+tryCount+')');
      tryCount++;
      let t = 1000*tryCount*tryCount;
      t = t>10*60*1000?10*60*1000:t;
      setTimeout(initLocalClient,t);
    }
  }
  setTimeout(initLocalClient,10000);

  router.get('/login',(req,res)=>{
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);
    req.session.local_code_verifier = code_verifier;

    const params = {
      scope: 'openid',
      code_challenge,
      code_challenge_method: 'S256'
    };
    let goToUrl = localClient.authorizationUrl(params);
    res.redirect(goToUrl);
  });

  router.get('/callback', async (req, res) => {
    var params = localClient.callbackParams(req);
    var code_verifier = req.session.local_code_verifier;
    try {
      // 以下のcallbackの第一引数、認証時に指定した
      // redirect_uriなんだけど、これちゃんとしないと。
      const tokenSet = await localClient.callback(config.localAPI.redirect_uris[0], params, { code_verifier });
      //const userinfo = await googleClient.userinfo(tokenSet.access_token);
      req.session.id_tokenX = tokenSet.id_token;
      const webid = tokenSet.claims().sub;
      const uid = config.server.webid2id(webid);
      let admin;
      if (config.admin.includes(webid))
        admin = true;
      else
        admin = false;
      req.session.webid = webid;
      req.session.uid = uid;
      res.cookie('webid', webid, {maxAge: config.server.session.maxAge });
      res.cookie('uid', uid, {maxAge: config.server.session.maxAge });
      res.cookie('admin', admin, {maxAge: config.server.session.maxAge });
      let user = null;
      for (let u of initial_users.users) {
        if (u.id === uid) {
          user = u;
          break;
        }
      }
      if (user === null) {
        const users = await colUsers.find({id:uid}).toArray();
        user = users[0];
      }
      const userInfo = JSON.stringify(user,null,2);
      res.render('local/result.ejs',{userInfo});
    } catch(err) {
      res.render('error.ejs',{message: JSON.stringify(err)});
    }
  });

  router.get("/logout", (req, res) => {
    let params;
    if (req.session.id_tokenX != undefined) {
      params = {
        /* response_type: '???', */
        /* scope: 'openid', */
        /* redirect_uri: 'http://localhost:3000/', */
        /* post_logout_redirect_uri: `https://${config.server.hostname}/`, */
        post_logout_redirect_uri: logout_redirect,
        id_token_hint: req.session.id_tokenX,
      };
    } else {
      params = {};
    }
    req.session.webid = null;
    req.session.uid = null;
    res.clearCookie('webid');
    res.clearCookie('uid');
    res.clearCookie('admin');
    const theUrl = localClient.endSessionUrl(params);
    res.redirect(theUrl);
  });

  return router;
};

export default init;
