import express from 'express';
import { readFile } from 'fs/promises';
import idsrv_init from './idsrv.js';

async function load_json(file_name) {
  return JSON.parse(
    await readFile(
      new URL(file_name, import.meta.url)
    )
  );
}

(async () => {
  const config = await load_json('./config.json');
  // Googleアカウントに設定されたmailをidに変換する
  // 関数を設定する。自動登録の時に使用される。
  // 対象外のメールアドレスの場合はnullを返すようにしなければならない。
  // (以下は情報大学の学生のみを自動登録の対象とした場合)
  config.server.email2id = function(email) {
    const m = email.match(/^s(\d{7})@s.do-johodai.ac.jp$/);
    if (!m) return null;
    return 's20'+m[1];
  };
  // idをwebidに変換する関数を設定する
  config.server.id2webid = function(id) {
    return 'https://'+config.server.hostname+'/people/'+id+'#me';
  };
  // webidをidに変換する関数を設定する
  config.server.webid2id = function(webid) {
    return webid.match(/^.*\/([^\/]+)#[^#]+$/)[1];
  };

  const idsrv = await idsrv_init(config);

  const expressApp = express();

  expressApp.get('/robots.txt',(req,res)=>{
    res.header('Content-Type', 'text/plain');
    res.end("User-agent: *\nDisallow: /\n");
  });

  expressApp.use('/',idsrv);

  expressApp.get('/',(req,res)=>{
    res.redirect('/idsrv_top');
  });

  // express listen
  expressApp.listen(config.server.port,()=>{
    console.log(`check [http|https]://${config.server.hostname}:${config.server.port}${config.server.prefix}/.well-known/openid-configuration`);
  });
})();
