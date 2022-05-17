/*
 * express.staticのように静的なファイルを
 * 配信するrouterだけど、拡張子を省略して
 * アクセスされた時にも応答するようにしている。
 * (Semantic Web的に重要)
 * 本当はクライアントからのAcceptヘッダーとかを
 * 解析して応答すべきなんだけど、以下のソース中の
 * priority配列で指定された拡張子の順番で
 * ファイルを探していって、最初に見付かった
 * ファイルで応答するという実装になってる。
 * (priority配列は設定ファイルで置き換え可能)
 * (ネーミングはextension-lessより。)
 */

import express from 'express';
import fsp from 'fs/promises';
import path from 'path';
import mime from 'mime-types';

const default_priority = [
  ".ttl", ".rdf",
  ".xml",
  ".html", ".htm", ".xhtml",
  ".css",
  ".js",
  ".json",
  ".png", ".jpg", ".jpeg", ".gif", ".svg",
  ".txt",
  ".and_so_on"
];

function Router(doc_root, config) {

  const router = express.Router();

  let priority = default_priority;
  if (config)
    if (config.priority)
      priority = config.priority;

  const parentDir = {
    name: '..',
    isDirectory: function() { return true; }
  };

  // フォルダのindexを表示できるようにするミドルウェア
  const dirIndex = async function(req,res,next) {
    try {
      const the_path = path.join(doc_root,req.path);
      const stats = await fsp.stat(the_path);
      if (stats.isDirectory()) {
        if (the_path.endsWith('/')) {
          const files = await fsp.readdir(the_path,{withFileTypes:true});
          files.unshift(parentDir);
          const c_path = path.join('/ns',req.path);
          res.render('extless/dir_index',{c_path,files});
          return;
        } else {
          const basename = path.basename(the_path);
          res.redirect('./'+basename+'/');
          return;
        }
      }
    } catch(e) {
      // ignore
    }
    next();
  };

  // res.sendFile();してくれる関数
  function sendFile(res,f_path) {
    const ct = mime.contentType(path.extname(f_path));
    const opt = {
      headers: {
        'Content-Type': ct
      }
    };
    res.sendFile(f_path,opt);
  }

  router.get('/*', dirIndex, async (req,res,next)=>{
    //console.log("GAHA: extless.router.get()");
    const the_path = path.resolve(doc_root + req.path);
    const path_data = path.parse(the_path);
    try {
      await fsp.access(the_path); //無けりゃ例外
      sendFile(res,the_path);
    } catch (err) {
      try {
        const dir = await fsp.opendir(path_data.dir);
        const ents = [];
        let dirent;
        for await (dirent of dir) {
          if (dirent.isFile())
            if (dirent.name.startsWith(path_data.base))
              ents.push(dirent.name);
        }
        //dir.close();
        for (const p of priority) {
          for (const e of ents) {
            if (path_data.base+p === e) {
              sendFile(res,the_path+p);
              return;
            }
          }
        }
        res.status(404).send(`${req.path} dose not exist.`);
      } catch (error) {
        res.status(404).send(`${req.path} dose not exist!`);
      }
    }
  });

  return router;
}

export default { Router };
