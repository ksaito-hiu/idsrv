

systemdのユニットファイルだけじゃなく
rsyslogdとかjournald、logrotateの話も。

参考
* <https://qiita.com/r-ytakada/items/2f6d9eb6b540ceac64ae>
* <https://blog.k-bushi.com/post/tech/tips/use-logrotate/>

### systemdのユニットファイル

Ubuntuの場合の置き場所は`/lib/systemd/system/idsrv.service`。
以下では架空のユーザ名としてjohnを使ってidsrv.serviceの中身を
例示する。

```
[Unit]
Description=A WebID-OIDC authentication server
Documentation=https://github.com/ksaito-hiu/idsrv
After=network.target

[Service]
Type=simple
User=john
WorkingDirectory=/home/john/idsrv
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/john/.anyenv/envs/nodenv/shims"
ExecStart=/home/john/idsrv/bin/start.sh
Restart=on-failure
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=idsrv-daemon

[Install]
WantedBy=multi-user.target
```

修正すべき所は[Service]の以下のところ。

* User
* WorkingDirectory
* EnvironmentのPATH
    + ユニットファイル内では$PATHのように書いても
      展開されないので$PATHは使えない。なので、
      上の例のように必要なパスは全部書かないといけない。
      また、nodeをnodenvやanyenvを使って管理している
      場合は、上の例のようにnodeが実行できるように
      PATHを追加しておくこと。
    + 環境変数で他に必要な物がある場合には同様にして
      設定すべし。
* ExecStart

ファイルができたらsystemctlコマンドで有効化したり起動
したりさせる。

```
systemctl daemon-reload
systemctl enable idsrv.service
systemctl start idsrv.service
systemctl status idsrv.service
systemctl stop idsrv.service
systemctl disable idsrv.service
journalctl -u idsrv
```

### rsyslogd設定

前準備としてログを保存するフォルダを用意する。

```
sudo mkdir /var/log/idsrv
sudo chown syslog:adm /var/log/idsrv
sudo chmod 750 /var/log/idsrv
```

場所は`/etc/rsyslog.d/idsrv-daemon.conf`。中身は以下。

```
:programname, startswith, "idsrv-daemon" /var/log/idsrv/idsrv.log
```

反映させるには以下。

```
sudo systemctl restart rsyslog
sudo systemctl stop idsrv.service
sudo systemctl start idsrv.service
```

### journaldの制限解除

大量のログを吐くとログがフィルタリングされる。
それで良ければ必要ないけど、その制限を解除
するには/etc/systemd/journald.confに以下を追加。

```
RateLimitIntervalSec=0
```

たぶんデフォルトは0でなく30s。あとRateLimitBurst=10000
みたいな設定もあるっぽい。設定を反映させるには以下。

```
sudo systemctl restart systemd-journald
```

でも、これはjournald全体の設定っぽいし自分では
試していない。

### logrotateの設定

`/etc/logrotate.d/idsrv`に以下のように書く。

```
/var/log/idsrv/idsrv.log
{
    missingok
    notifempty
    compress
    compresscmd /usr/bin/xz
    compressoptions -6
    rotate 90
    daily
    sharedscripts
    postrotate
        [ -x /usr/lib/rsyslog/rsyslog-rotate ] && /usr/lib/rsyslog/rsyslog-rotate || true
    endscript
}
```

postrotateの設定は参考ページと違う。Ubuntu22.04の
`/etc/logrotate.d/ufw`を参考にした。
上手く動作するかをdry-runで確認するには以下のコマンドを実行。

```
logrotate -dv /etc/logrotate.d/idsrv
```

たぶん上手くいってる。
