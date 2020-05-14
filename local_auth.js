const express = require('express');
const router = express.Router();
const { Issuer, generators } = require('openid-client');
const config = require('./config.json');

(async function() {
    let tryCount = 0;
    let localClient;
    router.wakeup = async function() {
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
        } catch(err) {
            console.log('Cannot search local openid-op. (tryCount='+tryCount+')');
            tryCount++;
            let t = 1000*tryCount*tryCount;
            t = t>10*60*1000?10*60*1000:t;
            setTimeout(router.wakeup,t);
        }
    }

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
            req.session.webid = tokenSet.claims().sub;
            res.render('RP/result.ejs',{result: 'id_token = '+tokenSet.id_token});
        } catch(err) {
            res.render('RP/error.ejs',{message: JSON.stringify(err)});
        }
    });

    router.get("/logout", (req, res) => {
        let params;
        if (req.session.id_tokenX != undefined) {
            params = {
                /* response_type: '???', */
                /* scope: 'openid', */
                /* redirect_uri: 'http://localhost:3000/', */
                post_logout_redirect_uri: 'https://id.do-johodai.ac.jp/',
                id_token_hint: req.session.id_tokenX,
            };
        } else {
            params = {};
        }
        req.session.webid = null;
        const theUrl = localClient.endSessionUrl(params);
        res.redirect(theUrl);
    });
})();

module.exports = router;
