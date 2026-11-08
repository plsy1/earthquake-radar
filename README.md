# 震源速览 · Earthquake Radar

一个单文件网页，把日本气象厅（JMA）公开的地震信息画在地图上：

- 最近约 30 天的有感地震，圆点颜色是气象厅的震度配色，大小对应震级
- 每 60 秒自动更新，新地震带"新"标记，最新一次地震有闪烁圆圈
- 按时间（24 小时 / 7 天 / 全部）和最大震度筛选
- 可以在地图上点选"我的位置"，列表会显示每次地震离你多远，并标出 100 km 范围
  （位置只保存在你自己的浏览器里，默认是名古屋站）
- 可以叠加南海海槽巨大地震设想震源区的大致轮廓

## 使用

直接用浏览器打开 `index.html` 即可，没有构建步骤，也不需要服务器。
如果浏览器不允许本地文件读取网络数据，可以在本目录运行一个简单的服务器：

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 数据来源

- 地震数据：[气象厅 防災情報 JSON](https://www.jma.go.jp/bosai/quake/data/list.json)（[地震情報](https://www.jma.go.jp/bosai/map.html#contents=earthquake_map)）
- 底图：[国土地理院 淡色地図](https://maps.gsi.go.jp/development/ichiran.html)
- 地图库：[Leaflet](https://leafletjs.com/) 1.9.4

南海海槽设想震源区是参照内阁府（2012 年）的原图手工描出的近似轮廓，只用于示意，
准确范围请以[气象厅](https://www.jma.go.jp/jma/kishou/know/jishin/nteq/assumption.html)和内阁府发布的资料为准。

本页面不是官方信息。地震发生时请以气象厅、NHK 和所在自治体发布的信息为准。
