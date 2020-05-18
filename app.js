const path = require('path');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const Provider = require('oidc-provider');
const fetch = require('node-fetch');

const config = require('./config.json');
const clients = require('./clients.json');

const MongoAdapter = require('./mongodb');
const jwks = require('./jwks.json');

const google_auth = require('./google_auth');
const yahoo_auth = require('./yahoo_auth');
const local_auth = require('./local_auth');
const admin = require('./admin');
const auto_register = require('./auto_register');
const people = require('./people');

const extless = require('./extless');

// await sleep(1000); とかして使う
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

// simple account model for this application, user list is defined like so
const Account = require('./account')();

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

(async function() {
  const oidc_uri = 'https://'+config.server.hostname
  await MongoAdapter.connect();
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

  // let's work with express here, below is just the interaction definition
  const expressApp = express();

  expressApp.set('trust proxy', true);
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', path.resolve(__dirname, 'views'));

  // サーバー全体に対して
  // CORS(Cross-Origin Resource Sharing)
  expressApp.use(allowCrossDomain);

  const parse = bodyParser.urlencoded({ extended: false });

  expressApp.use(session({
    secret: 'some secret string',
    resave: false,
    saveUninitialized: false, //??? しかも要るかな？
    httpOnly: true, // openid-clientパッケージの要請
    secure: true, // openid-clientパッケージの要請
    //cookie: { path: '/auth', maxAge: 30 * 60 * 1000 }
    cookie: { maxAge: 30 * 60 * 1000 }
  }));

  function setNoCache(req, res, next) {
    res.set('Pragma', 'no-cache');
    res.set('Cache-Control', 'no-cache, no-store');
    next();
  }

  expressApp.get('/interaction/:uid', setNoCache, async (req, res, next) => {
    try {
      const details = await oidc.interactionDetails(req);
      const { uid, prompt, params } = details;

      const client = await oidc.Client.find(params.client_id);

      if (prompt.name === 'login') {
        return res.render('OP/login',{ provider_session_uid: details.uid });
      }

      return res.render('OP/interaction', {
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

  expressApp.get('/interaction/:uid/login', setNoCache, parse, async (req, res, next) => {
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

  expressApp.post('/interaction/:uid/confirm', setNoCache, parse, async (req, res, next) => {
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

  expressApp.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
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

  expressApp.use('/auth/google',google_auth);
  expressApp.use('/auth/yahoo',yahoo_auth);
  expressApp.use('/auth/local',local_auth);
  expressApp.use('/admin',admin);
  expressApp.use('/auto_register',auto_register);
  expressApp.use('/people',people);

  expressApp.get('/robots.txt',(req,res)=>{
    res.header('Content-Type', 'text/plain');
    res.end("User-agent: *\nDisallow: /\n");
  });

  expressApp.get('/',(req,res)=>{
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
    res.render('OP/index.ejs',{msg:str});
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
  expressApp.use(config.server.prefix,oidc.callback);
  expressApp.get('/.well-known/openid-configuration',
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
  //expressApp.use(express.static(config.server.static));

  // 基本的に、静的なファイルを配信する。
  // extlessは拡張子無しのアクセスに対応するexpress.static
  const router = extless.Router(config.server.static,config.extless);
  expressApp.use(router);

  // express listen
  const server = expressApp.listen(config.server.port,async ()=>{
    console.log(`check https://${config.server.hostname}${config.server.prefix}/.well-known/openid-configuration`);
    // await sleep(10000); // 意味ないみたい
    local_auth.wakeup();
  });
})();
