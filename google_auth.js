const express = require('express');
const router = express.Router();
const { Issuer, generators } = require('openid-client');
const config = require('./config.json');

(async function() {
  let tryCount = 0;
  let googleClient = null;
  const initGoogleClient = async function() {
    try {
      const issuer = await Issuer.discover('https://accounts.google.com');
      //console.log('Discovered issuer %s %O',
      //            issuer.issuer,issuer.metadata)
      googleClient = new issuer.Client({
        client_id: config.googleAPI.client_id,
        client_secret: config.googleAPI.client_secret,
        redirect_uris: config.googleAPI.redirect_uris,
        response_types: ['code'],
        // id_token_signed_response_alg (default "RS256")
        // token_endpoint_auth_method (default "client_secret_basic")
      });
    } catch(err) {
      console.log('Cannot search google openid-op. (tryCount='+tryCount+')');
      tryCount++;
      let t = 1000*tryCount*tryCount;
      t = t>10*60*1000?10*60*1000:t;
      setTimeout(initGoogleClient,t);
    }
  }
  await initGoogleClient();

  router.get('/login',(req,res)=>{
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);

    req.session.provider_session_uid = req.query.provider_session_uid;
    req.session.code_verifier = code_verifier;

    const params = {
      scope: 'openid',
      code_challenge,
      code_challenge_method: 'S256'
    };
    let goToUrl = googleClient.authorizationUrl(params);
    res.redirect(goToUrl);
  });

  router.get('/callback', async (req, res) => {
    var params = googleClient.callbackParams(req);

    var provider_session_uid = req.session.provider_session_uid;
    var code_verifier = req.session.code_verifier;

    try {
      // 以下のcallbackの第一引数、認証時に指定した
      // redirect_uriなんだけど、これちゃんとしないと。
      const tokenSet = await googleClient.callback(config.googleAPI.redirect_uris[0], params, { code_verifier });
      //const userinfo = await googleClient.userinfo(tokenSet.access_token);
      res.redirect('/interaction/'+provider_session_uid+'/login?accountId=google-'+tokenSet.claims().sub);
    } catch(err) {
      res.redirect('/interaction/'+provider_session_uid+'/abort');
    }
  });

  router.get("/logout", (req, res) => {
    let params;
    if (req.session.id_tokenX != undefined) {
      params = {
        /* response_type: '???', */
        /* scope: 'openid', */
        /* redirect_uri: 'http://localhost:3000/', */
        /* post_logout_redirect_uri: 'http://localhost:3000/', */
        id_token_hint: req.session.id_tokenX,
      };
    } else {
      params = {};
    }
    const theUrl = googleClient.endSessionUrl(params);
    res.redirect(theUrl);
  });

  // 別の所でも再利用したいので
  router.googleClient = googleClient;
  router.generators = generators;
})();

module.exports = router;
