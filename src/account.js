//import { LowSync, MemorySync } from 'lowdb';
//import jose from 'jose';

const init_users = new Map();

function Account(config,initial_users) {
  for (const user of initial_users.users)
    init_users.set(user.id,user);

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
    account = init_users.get(id);
    if (!account) {
      const as = await colUsers.find({ id }).toArray();
      if (as.length>0)
        account = as[0];
    }
    if (!account) {
      return undefined;
    }

    // 以下はlegacyPoPに対応するための一時凌ぎのコード。
    // Implicit Flowでは上手く機能するみたいだけど
    // Authorization Code Flowでは上手く機能しないことの
    // 方が多い。将来的には完全に消したい。
    //if (!!ctx.oidc.client) {
    //  const r = /request=([^&]*)/.exec(ctx.originalUrl);
    //  if (!!r) {
    //    if (!!r[1]) {
    //      const reqObj = jose.JWT.decode(r[1]);
    //      if (!!reqObj.key)
    //        ctx.oidc.client.pKey = reqObj.key;
    //    }
    //  }
    //}

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
        // 以下3行もlegacyPoPのための一時的なコード。
        // 将来的には消したい。
        //if (!!(ctx.oidc.client.pKey)) {
        //  cs.cnf = { jwk: ctx.oidc.client.pKey };
        //}
        return cs;
      },
    };
    return ret;
  };

  // 単にgoogleId(Googleのsub)からアカウントを探してidのみを返す
  self.findAccountByGoogleSub = async function(gid) {
    let account;
    for (const [id,user] of init_users) {
      if (user.googleId === gid) {
        account = user;
        break;
      }
    }
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
    let account;
    for (const [id,user] of init_users) {
      if (user.yahooId === yid) {
        account = user;
        break;
      }
    }
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

export default Account;
