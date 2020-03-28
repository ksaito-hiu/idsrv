const express = require('express');
const router = express.Router();
const { Issuer, generators } = require('openid-client');
const config = require('./config.json');

(async function() {
    let yahooClient;
    try {
        const issuer = await Issuer.discover('https://auth.login.yahoo.co.jp/yconnect/v2');
        //console.log('Discovered issuer %s %O',
        //            issuer.issuer,issuer.metadata)
        yahooClient = new issuer.Client({
            client_id: config.yahooAPI.client_id,
            client_secret: config.yahooAPI.client_secret,
            redirect_uris: config.yahooAPI.redirect_uris,
            response_types: ['code'],
            // id_token_signed_response_alg (default "RS256")
            // token_endpoint_auth_method (default "client_secret_basic")
        });
    } catch(err) {
        console.log('Cannot search yahoo openid-op.');
    }

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
        let goToUrl = yahooClient.authorizationUrl(params);
        res.redirect(goToUrl);
    });

    router.get('/callback', async (req, res) => {
        var params = yahooClient.callbackParams(req);

        var provider_session_uid = req.session.provider_session_uid;
        var code_verifier = req.session.code_verifier;

        try {
            // 以下のcallbackの第一引数、認証時に指定した
            // redirect_uriなんだけど、これちゃんとしないと。
            const tokenSet = await yahooClient.callback(config.yahooAPI.redirect_uris[0], params, { code_verifier });
            //const userinfo = await googleClient.userinfo(tokenSet.access_token);
            res.redirect('/interaction/'+provider_session_uid+'/login?accountId=yahoo-'+tokenSet.claims().sub);
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
        const theUrl = yahooClient.endSessionUrl(params);
        res.redirect(theUrl);
    });
})();

module.exports = router;
