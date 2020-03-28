const low = require('lowdb');
const Memory = require('lowdb/adapters/Memory');
const initial_users = require('./users.json');

const db = low(new Memory());

const assert = require('assert');

db.defaults({
  users: initial_users.users
}).write();

function Account() {
  const self = {};
  self.setProvider = function(provider) {
    self.prov = provider;
  }
  // This interface is required by oidc-provider
  // 以下のfindAccount関数は，accountId属性と
  // claims関数が入ったオブジェクトをPromiseで返す関数
  self.findAccount = async function(ctx, id,token) {
    if (!!ctx.oidc.client) {
      if (!!ctx.oidc.params.key) {
        ctx.oidc.client.pKey = ctx.oidc.params.key;
      }
    }

    // This would ideally be just a check whether the account is still in your storage
    let account;
    if (id.startsWith('google-'))
      account = db.get('users').find({ googleId: id }).value();
    else if (id.startsWith('yahoo-'))
      account = db.get('users').find({ yahooId: id }).value();
    if (!account) {
      return undefined;
    }

    return {
      accountId: account.id,
      // and this claims() method would actually query to retrieve the account claims
      async claims() {
        const cs = {
          sub: account.id,
          webid: account.webid,
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
  return self;
}

module.exports = Account;
