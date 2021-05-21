const low = require('lowdb');
const Memory = require('lowdb/adapters/Memory');
const jose = require('jose2');

const db = low(new Memory());

const assert = require('assert');

function Account(config,initial_users) {
  db.defaults({
    users: initial_users.users
  }).write();

  const self = {};
  let colUsers = null; // <- MongoDBにユーザー情報入れるためのcollection
  self.setProvider = function(provider) {
    self.prov = provider;
  }
  // This interface is required by oidc-provider
  // 以下のfindAccount関数は，accountId属性と
  // claims関数が入ったオブジェクトをPromiseで返す関数
  self.findAccount = async function(ctx, id,token) {
    // This would ideally be just a check whether the account is still in your storage
    let account;
    account = db.get('users').find({ id }).value();
    if (!account) {
      const as = await colUsers.find({accountId: id }).toArray();
      if (as.length>0)
        account = as[0];
    }
    if (!account) {
      return undefined;
    }

    // ここで返す値なのだけど、solid-auth-client.bundle.jsの
    // 実装をテストした感じではsubにwebidを設定してwebidという
    // claimsは付けずに返事してる。以前仕様を調べた時には
    // webidというclaimsが優先される感じかと思ったので、
    // 一応以下のようにsubとwebidの両方にwebidの情報をセットしてみる。
    const ret = {
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
        return cs;
      },
    };
    return ret;
  };

  // 単にgoogleId(Googleのsub)からアカウントを探してidのみを返す
  self.findAccountByGoogleSub = async function(gid) {
    let account = db.get('users').find({ googleId: gid }).value();
    if (!account) {
      const as = await colUsers.find({googleId: gid}).toArray();
      if (as.length>0)
        account = as[0];
      else
        return undefined;
    }
    return account.id;
  }

  // 単にyahooId(Yahooのsub)からアカウントを探してidのみを返す
  self.findAccountByYahooSub = async function(yid) {
    let account = db.get('users').find({ googleId: gid }).value();
    if (!account) {
      const as = await colUsers.find({googleId: gid}).toArray();
      if (as.length>0)
        account = as[0];
      else
        return undefined;
    }
    return account.id;
  }

  self.connect = function(mongoClient) {
    colUsers = mongoClient.db('idsrv').collection('users');
  }
  return self;
}

module.exports = Account;
