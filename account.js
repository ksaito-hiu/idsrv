const low = require('lowdb');
const Memory = require('lowdb/adapters/Memory');
const jose = require('jose');
const initial_users = require('./users.json');

const db = low(new Memory());

const assert = require('assert');

db.defaults({
  users: initial_users.users
}).write();

function Account(config) {
  const self = {};
  let colUsers = null; // <- MongoDBにユーザー情報入れるためのcollection
  self.setProvider = function(provider) {
    self.prov = provider;
  }
  // This interface is required by oidc-provider
  // 以下のfindAccount関数は，accountId属性と
  // claims関数が入ったオブジェクトをPromiseで返す関数
  self.findAccount = async function(ctx, id,token) {
    /* このコードはoidc-providerの修正が前提。
     * その修正は受理されなかったので別の方法が必要
    if (!!ctx.oidc.client) {
      if (!!ctx.oidc.params.key) {
        ctx.oidc.client.pKey = ctx.oidc.params.key;
      }
    }
    */
    // ということで以下のようにした
    // これでもAuthorization Code Flowの時は
    // うまくいかないことの方が多い。
    if (!!ctx.oidc.client) {
      const r = /request=([^&]*)/.exec(ctx.originalUrl);
      if (!!r) {
        if (!!r[1]) {
          const reqObj = jose.JWT.decode(r[1]);
          if (!!reqObj.key)
            ctx.oidc.client.pKey = reqObj.key;
        }
      }
    }

    // This would ideally be just a check whether the account is still in your storage
    let account;
    if (id.startsWith('google-')) {
      const gid = id.substring(7);
      account = db.get('users').find({ googleId: gid }).value();
      if (!account) {
        const as = await colUsers.find({googleId: gid }).toArray();
        if (as.length>0)
          account = as[0];
      }
    } else if (id.startsWith('yahoo-')) {
      const yid = id.substring(6);
      account = db.get('users').find({ yahooId: yid }).value();
      if (!account) {
        const as = await colUsers.find({yahooId: yid }).toArray();
        if (as.length>0)
          account = as[0];
      }
    }
    if (!account) {
      return undefined;
    }

    // ここで返す値なのだけど、solid-auth-client.bundle.jsの
    // 実装をテストした感じではsubにwebidを設定してwebidという
    // claimsは付けずに返事してる。以前使用を調べた時には
    // webidというclaimsが優先される感じかと思ったので、
    // 一応以下のようにsubとwebidの両方にwebidの情報をセットしてみる。
    return {
      accountId: account.id,
      // and this claims() method would actually query to retrieve the account claims
      async claims() {
        const cs = {
          sub: config.server.id2webid(account.id),
          webid: config.server.id2webid(account.id),
          name: 'dummy',
          birthdate: 'dummy',
          gender: 'dummy',
        };
        if (!!(ctx.oidc.client.pKey)) {
          cs.cnf = { jwk: ctx.oidc.client.pKey };
        }
        return cs;
      },
    };
  };
  self.connect = function(mongoClient) {
    colUsers = mongoClient.db('idsrv').collection('users');
  }
  return self;
}

module.exports = Account;
