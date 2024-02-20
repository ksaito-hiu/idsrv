





Ubuntu22.04の場合。`/etc/nginx/sites-abailable/default`に以下の
ように設定。「id.mydomain.com」の所と「8080」の所を書き換え。

    # HTTPの設定
    server{
	listen 80;
	server_name id.mydomain.com;

	#HTTPで接続された場合、HTTPSで同URLにリダイレクトさせる。
	return 301 https://$host$request_uri;
    }

    # HTTPSの設定
    server{
	server_name id.mydomain.com;

	listen [::]:443 ssl ipv6only=on;
	listen 443 ssl;
	ssl_certificate /etc/letsencrypt/live/id.mydomain.com/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/id.mydomain.com/privkey.pem;
	include /etc/letsencrypt/options-ssl-nginx.conf;
	ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

	proxy_set_header Host $host;
	proxy_set_header X-Real-IP $remote_addr;
	proxy_set_header X-Forwarded-Host $host;
	proxy_set_header X-Forwarded-Server $host;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto $scheme;

	add_header Access-Control-Allow-Headers "Authorization, X-XSRF-TOKEN, DPOP";

	location / {
	    # プロキシ先のサーバアドレスとポート番号を指定
	    proxy_pass    http://localhost:8080;
	    proxy_redirect off;
	}
    }

このファイルは`/etc/nginx/nginx.confg`からincludeされる。
