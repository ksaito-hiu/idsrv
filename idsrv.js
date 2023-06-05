/*
 * このidsrvというexpress appはサーバーのルート(/)に配備して使う前提で
 * 作られてます。
 * const config = require('./config.json');
 * const idsrv = await require('./idsrv')(config);
 * という感じにやります。awaitを使うのでasyncな関数で
 * 囲まれた場所でやって下さい。
 */

import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import Provider from 'oidc-provider';
import fetch from 'node-fetch';
import path from 'path';
import i18n from 'i18n';
import { readFile } from 'fs/promises';
import account_init from './account.js';
import google_auth_init from './google_auth.js';
import yahoo_auth_init from './yahoo_auth.js';
import local_auth_init from './local_auth.js';
import admin_init from './admin.js';
import register_init from './register.js';
import people_init from './people.js';
import certificate_init from './certificate.js';
import extless from './extless.js';

import { default as mongodb } from 'mongodb';
const MongoClient = mongodb.MongoClient;
import MongoAdapter from './mongo_adapter.js';
let mongoClient = null;

async function load_json(file_name) {
  return JSON.parse(
    await readFile(
      new URL(file_name, import.meta.url)
    )
  );
}

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
  const idsrv_root = path.resolve(config.idsrv_root);
  const jwks = await load_json(path.join(idsrv_root,'jwks.json'));
  const clients = await load_json(path.join(idsrv_root,'clients.json'));
  const initial_users = await load_json(path.join(idsrv_root,'users.json'));

  // emailをidに変換する関数が設定されていなければ以下の
  // 関数で処理する。(デフォルト実装はgmailを過程して、
  // その@より左をidにする。ここでマッチしなかった場合は
  // 許可されていないメールアドレスということで自動
  // 登録の対象外とする。
  if (!config.server.email2id) {
    config.server.email2id = function(email) {
      const m = email.match(/^(.*)@gmail.com$/);
      if (!m) return null;
      return m[1];
    };
  }
  // idをWebIDに変換する関数が設定されてなければ以下の
  // 関数で処理する。
  if (!config.server.id2webid) {
    config.server.id2webid = function(id) {
      return 'https://'+config.server.hostname+'/people/'+id+'#me';
    };
  }
  // WebIDをidに変換する関数が設定されてなければ以下の
  // 関数で処理する。
  if (!config.server.webid2id) {
    config.server.webid2id = function(webid) {
      return webid.match(/^.*\/([^\/]+)#[^#]+$/)[1];
    };
  }

  const idsrv = express();
  idsrv.set('trust proxy', true);
  idsrv.set('view engine', 'ejs');
  idsrv.set('views', path.join(idsrv_root,'views'));

  // 2022,05/27: 以下の設定はリクエストのbodyを
  // パースしてreq.body.XXXが使えるようにする物。
  // ここで設定してidsrv全体で使えるようにしてたけど
  // oidc-providerには付けちゃだめだった。さらにgrep
  // してみたらreq.body使ってるところない。コメント
  // アウトしておく。
  //idsrv.use(express.json());
  //idsrv.use(express.urlencoded({ extended: true }));

  i18n.configure({
    locales: ['en', 'ja'],
    directory: path.join(idsrv_root,'locales')
  });
  idsrv.use(i18n.init);

  idsrv.use(session({
    secret: config.server.session.secret,
    resave: false,
    saveUninitialized: false, //??? しかも要るかな？
    httpOnly: true, // openid-clientパッケージの要請
    secure: true, // openid-clientパッケージの要請
    cookie: { maxAge: config.server.session.maxAge }
  }));

  idsrv.use(cookieParser());

  // simple account model for this application, user list is defined like so
  const Account = account_init(config,initial_users);
  const google_auth = await google_auth_init(config,Account);
  const yahoo_auth = await yahoo_auth_init(config,Account);
  let logout_redirect = "http://localhost:8080/"; // 最悪の場合のデフォルト
  for (let i=0;i<clients.settings.length;i++) {
    const c = clients.settings[i];
    if (c.client_id === "local") {
      logout_redirect = c.post_logout_redirect_uris[0]; // 1つしか指定しないということで
      break;
    }
  }
  const local_auth = await local_auth_init(config,initial_users,logout_redirect);
  const admin = await admin_init(config,clients,initial_users);
  const register = await register_init(config,initial_users);
  register.set_google_auth(google_auth); // google_auth.googleClientを再利用するため
  register.set_yahoo_auth(yahoo_auth); // yahoo_auth.googleClientを再利用するため
  const people = await people_init(config);
  const certificate = await certificate_init(config,initial_users);

  const oidc_uri = 'https://'+config.server.hostname
  mongoClient = new MongoClient('mongodb://127.0.0.1:27017',{
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await mongoClient.connect();
  MongoAdapter.connect(mongoClient);
  Account.connect(mongoClient);
  register.setMongoClient(mongoClient);
  admin.set_mongo_client(mongoClient);
  local_auth.set_mongo_client(mongoClient);
  certificate.set_mongo_client(mongoClient);
  people.set_mongo_client(mongoClient);
  const oidc = new Provider(oidc_uri, {
    adapter: MongoAdapter,
    "clients": clients.settings,
    cookies: {
      long: { signed: true,
              maxAge: config.server.op_cookies.maxAge
            },
      short: { signed: true },
      keys: config.server.op_cookies.keys
    },
    jwks,
    findAccount: Account.findAccount,
    claims: {
      //openid: ['sub','webid','cnf'],
      openid: ['sub','webid'],
      profile: ['name','birthdate','gender']
    },
    responseTypes: [
      `code`,
      `code token`,
      `code id_token`,
      `id_token code`, // 上と同じだからか有効化できない
      `id_token`,
      `id_token token`,
      `code id_token token`,
      `none`
    ],
    interactions: {
      url: async function(ctx, interaction) {
        return `/interaction/${interaction.uid}`;
      }
    },
    features: {
      // disable the packaged interactions
      devInteractions: { enabled: false },
      introspection: { enabled: true }, // RFC7662 2022,06/13 changed
      //revocation: { enabled: true }, // RFC7009

      registration: { enabled: true },
      requestObjects: {
        mode: 'lax',
        request: true, // 2022,06/13 changed
        requestUri: false,
        requireUriRegistration: false,
      },
      clientCredentials: { enabled: true },
      dPoP: { enabled: true },
    },
    enabledJWA: {
      requestObjectSigningAlgValues: [
        //'none', // 2023,06/05: 昔これを付けたけど今これがあると起動しない
        'HS256',
        'RS256',
        'PS256',
        'ES256',
        'EdDSA'
      ]
    },
    // extraParams: ['key'],
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
  idsrv.use(allowCrossDomain);

  function setNoCache(req, res, next) {
    res.set('Pragma', 'no-cache');
    res.set('Cache-Control', 'no-cache, no-store');
    next();
  }

  idsrv.get('/interaction/:uid', setNoCache, async (req, res, next) => {
    try {
      const details = await oidc.interactionDetails(req,res);
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

  idsrv.get('/interaction/:uid/login', setNoCache, async (req, res, next) => {
    try {
      const { uid, prompt, params } = await oidc.interactionDetails(req,res);
      const client = await oidc.Client.find(params.client_id);

      const accountId = req.query.accountId;

      const result = {
        login: { accountId },
      };
      await oidc.interactionFinished(req, res, result,
                                     { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  idsrv.post('/interaction/:uid/confirm', setNoCache, async (req, res, next) => {
    try {
      const interactionDetails = await oidc.interactionDetails(req, res);
      const { prompt: { name, details }, params, session: { accountId } } = interactionDetails;
      //assert.strictEqual(name, 'consent');

      let { grantId } = interactionDetails;
      let grant;

      if (grantId) {
        // we'll be modifying existing grant in existing session
        grant = await oidc.Grant.find(grantId);
      } else {
        // we're establishing a new grant
        grant = new oidc.Grant({
          accountId,
          clientId: params.client_id,
        });
      }

      if (details.missingOIDCScope) {
        grant.addOIDCScope(details.missingOIDCScope.join(' '));
        // use grant.rejectOIDCScope to reject a subset or the whole thing
      }
      if (details.missingOIDCClaims) {
        grant.addOIDCClaims(details.missingOIDCClaims);
        // use grant.rejectOIDCClaims to reject a subset or the whole thing
      }
      if (details.missingResourceScopes) {
        // eslint-disable-next-line no-restricted-syntax
        for (const [indicator, scopes] of Object.entries(details.missingResourceScopes)) {
          grant.addResourceScope(indicator, scopes.join(' '));
          // use grant.rejectResourceScope to reject a subset or the whole thing
        }
      }

      grantId = await grant.save();

      const consent = {};
      if (!interactionDetails.grantId) {
        // we don't have to pass grantId to consent, we're just modifying existing one
        consent.grantId = grantId;
      }

      const result = { consent };
      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
    } catch (err) {
      next(err);
    }
  });

  idsrv.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
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

  idsrv.use('/auth/google',google_auth);
  idsrv.use('/auth/yahoo',yahoo_auth);
  idsrv.use('/auth/local',local_auth);
  idsrv.use('/admin',admin);
  idsrv.use('/register',register);
  idsrv.use('/people',people);
  idsrv.use('/certificate',certificate);

  idsrv.get('/idsrv_top',(req,res)=>{
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
    res.render('index.ejs',{msg:str});
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
  idsrv.use(config.server.prefix,oidc.callback());
  idsrv.get('/.well-known/openid-configuration',
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
                     res.header('Content-Type', 'application/json');
                     res.end(txt);
                   } catch (err) {
                     res.header('Content-Type', 'application/json');
                     const error = err.toString();
                     res.end(`{ "err": "${error}" }`);
                   }
                 });

  // 基本的に、静的なファイルを配信する。
  //idsrv.use('/ns',express.static(config.server.static));

  // 基本的に、静的なファイルを配信する。
  // extlessは拡張子無しのアクセスに対応するexpress.static
  const extless_router = extless.Router(config.server.static,config.extless);
  idsrv.use('/ns',extless_router);

  return idsrv;
};

export default init;
