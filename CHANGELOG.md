# Changelog

### 2024,03/04:

* CommunitySolidServer(https://github.com/CommunitySolidServer/CommunitySolidServer)
  のソースの中(CommunitySolidServer/config/identify/handler/base/provider-factory.json)
  にoidc-providerのProviderをnewする時に渡すoptionのデフォルト値っぽいものを発見。
  具体的には、`そのJSONファイル.@graph[0].config`の所。
  これを参考にidsrv.jsの中で与えるオプションを調整してみようと思う。

### 2022,06/13:

* だいぶ前に変更してたけど、commitするべきか迷ってた。
  solidcommunity.netの自分のプロファイルのttlとか見てみると
  space:preferencesFileとかsolid:privateTypeIndexとか
  solid:publicTypeIndexなどの情報が加わっていた。
  これに対応するには別のURLに新しいttlファイルを
  用意する必要があるみたいなんだが、これをpeople.jsを
  修正して対応した。しばらく使っててたぶん問題ない
  ので、commitすることにした。ダメだったら2022,06/13の
  前まで戻すべし。
