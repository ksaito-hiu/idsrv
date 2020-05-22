/*
 * このidsrvというrouterはサーバーのルート(/)に配備して使う前提で
 * 作られてます。また、express-sessionが設定済みで、テンプレート
 * エンジンにejsが設定されておりviewsのディレクトリも設定済みで
 * あることも前提となっています。routerを生成するには適切な設定
 * ファイルを用意して以下のようにします。
 * const config = require('./config.json');
 * const idsrv = await require('./idsrv')(config);
 * という感じにやります。
 */

const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const Provider = require('oidc-provider');
const fetch = require('node-fetch');

const clients = require('./clients.json');

const { MongoClient } = require('mongodb');
const MongoAdapter = require('./mongo_adapter');
let mongoClient = null;

// CORS(Cross-Origin Resource Sharing)対応のミドルウェア。
const allowCrossDomain = function(req,res,next) {
  const origin = req.get('Origin');
  if (origin===undefined) {
    res.header('Access-Control-Allow-Origin','*');
  } else {
    res.header('Access-Control-Allow-Origin',origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, access_token'
  );
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method==='OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

const init = async function(config) {
  const jwks = require(config.server.jwks);

  const google_auth = await require('./google_auth')(config);
  const yahoo_auth = await require('./yahoo_auth')(config);
  const local_auth = await require('./local_auth')(config);
  const admin = await require('./admin')(config);
  const register = await require('./register')(config);
  register.set_google_auth(google_auth); // google_auth.googleClientを再利用するため
  const people = await require('./people')(config);
  const extless = require('./extless');
  // simple account model for this application, user list is defined like so
  const Account = require('./account')();

  const oidc_uri = 'https://'+config.server.hostname
  mongoClient = new MongoClient('mongodb://127.0.0.1:27017',{
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await mongoClient.connect();
  MongoAdapter.connect(mongoClient);
  Account.connect(mongoClient);
  const oidc = new Provider(oidc_uri, {
    adapter: MongoAdapter,
    "clients": clients.settings,
    cookies: {
      long: { signed: true,
              maxAge: config.server.cookies.maxAge
            },
      short: { signed: true },
      keys: config.server.cookies.keys
    },
    jwks,
    findAccount: Account.findAccount,
    claims: {
      openid: ['sub','webid','cnf'],
      profile: ['name','birthdate','gender']
    },
    responseTypes: [
      `code id_token token`,
      `id_token token`,
      `code id_token`,
      `code token`,
      `code`,
      `token`,
      `id_token`,
      `none`
    ],
    interactions: {
      url: async function(ctx, interaction) {
        return `/interaction/${ctx.oidc.uid}`;
      }
    },
    features: {
      // disable the packaged interactions
      devInteractions: { enabled: false },
      introspection: { enabled: true }, // RFC7662
      revocation: { enabled: true }, // RFC7009

      registration: { enabled: true },
      requestObjects: {
        request: true,
        requestUri: false,
        requireUriRegistration: false,
      },
      clientCredentials: { enabled: true },
      //dPoP: { enabled: true },
    },
    whitelistedJWA: {
      requestObjectSigningAlgValues: [
        'none', // これを付け加えた
        'HS256',
        'RS256',
        'RS384',
        'RS512',
        'PS256',
        'ES256',
        'EdDSA'
      ]
    },
    extraParams: ['key'],
    /*
      async extraAccessTokenClaims(ctx,token) {
      ctx.oidc.issuer.substring(0);
      token.jti.substring(0);
      return { 'cnf': 'bar', };
      },
    */
  });
  Account.setProvider(oidc);

  oidc.proxy = true;
  //oidc.keys = process.env.SECURE_KEY.split(',');

  // サーバー全体に対して
  // CORS(Cross-Origin Resource Sharing)
  router.use(allowCrossDomain);

  const parse = bodyParser.urlencoded({ extended: false });

  function setNoCache(req, res, next) {
    res.set('Pragma', 'no-cache');
    res.set('Cache-Control', 'no-cache, no-store');
    next();
  }

  router.get('/interaction/:uid', setNoCache, async (req, res, next) => {
    try {
      const details = await oidc.interactionDetails(req);
      const { uid, prompt, params } = details;

      const client = await oidc.Client.find(params.client_id);

      if (prompt.name === 'login') {
        return res.render('login',{ provider_session_uid: details.uid });
      }

      return res.render('interaction', {
        client,
        uid,
        details: prompt.details,
        params,
        title: 'Authorize',
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/interaction/:uid/login', setNoCache, parse, async (req, res, next) => {
    try {
      const { uid, prompt, params } = await oidc.interactionDetails(req);
      const client = await oidc.Client.find(params.client_id);

      const accountId = req.query.accountId;

      const result = {
        login: {
          account: accountId,
        },
      };
      await oidc.interactionFinished(req, res, result,
                                     { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  router.post('/interaction/:uid/confirm', setNoCache, parse, async (req, res, next) => {
    try {
      const result = {
        consent: {
          // rejectedScopes: [], // < uncomment and add rejections here
          // rejectedClaims: [], // < uncomment and add rejections here
        },
      };
      await oidc.interactionFinished(req, res, result,
                                     { mergeWithLastSubmission: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
    try {
      const result = {
        error: 'access_denied',
        error_description: 'End-User aborted interaction',
      };
      await oidc.interactionFinished(req, res, result,
                                     { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  router.use('/auth/google',google_auth);
  router.use('/auth/yahoo',yahoo_auth);
  router.use('/auth/local',local_auth);
  router.use('/admin',admin);
  router.use('/register',register);
  router.use('/people',people);

  router.get('/robots.txt',(req,res)=>{
    res.header('Content-Type', 'text/plain');
    res.end("User-agent: *\nDisallow: /\n");
  });

  router.get('/',(req,res)=>{
    let str;
    if (!!req.session) {
      if (!!req.session.webid) {
        str = `You are logged in as ${req.session.webid}.`;
      } else {
        str = 'You are not logged in.';
      }
    } else {
      str = 'You are not logged in. (no session)';
    }
    let admin;
    if (config.admin.includes(req.session.webid)) {
      admin = true;
    } else {
      admin = false;
    }
    res.render('index.ejs',{msg:str,admin});
  });

  // oidc-providerはプレフィックス付けて運用する。
  // で，Solidのimplicitなクライアント(RP)，
  // 具体的にはsolid-auth-clientがこれに対応できる
  // ようにするためには/.well-known/openid-configuration
  // を/oidc/.well-known/openid-configuration に
  // rewriteされるように設定しておかないとならない。
  // 今回の場合301でリダイレクトするのはダメで、
  // nginxでrewriteで簡単に設定できなかったので
  // node-fetchを使って以下のようにした。
  router.use(config.server.prefix,oidc.callback);
  router.get('/.well-known/openid-configuration',
                 async (req,res) => {
                   try {
                     const opt = {
                       headers: {
                         'Host': req.hostname,
                         'X-Real-IP': req.ip,
                         'X-Forwarded-Host': req.hostname,
                         'X-Forwarded-Server': req.hostname,
                         'X-Forwarded-For': req.ips,
                         'X-Forwarded-Proto': req.protocol
                       }
                     };
                     const response = await fetch(`http://localhost:${config.server.port}${config.server.prefix}/.well-known/openid-configuration`,opt);
                     const txt = await response.text();
                     res.header('Content-Type', 'text/json');
                     res.end(txt);
                   } catch (err) {
                     res.header('Content-Type', 'text/json');
                     const error = err.toString();
                     res.end(`{ "err": "${error}" }`);
                   }
                 });

  // 基本的に、静的なファイルを配信する。
  //router.use(express.static(config.server.static));

  // 基本的に、静的なファイルを配信する。
  // extlessは拡張子無しのアクセスに対応するexpress.static
  const extless_router = extless.Router(config.server.static,config.extless);
  router.use(extless_router);

  return router;
};

module.exports = init;
