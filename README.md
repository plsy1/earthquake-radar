# 震源速览 · Earthquake Radar

一个纯静态网页（无构建步骤），把日本气象厅（JMA）公开的地震信息画在地图上：

- 最近约 30 天的有感地震，圆点颜色是气象厅的震度配色，大小对应震级
- 每 60 秒自动更新，新地震带"新"标记，最新一次地震有闪烁圆圈
- 按时间（24 小时 / 7 天 / 全部）和最大震度筛选
- "我的位置"是可选的：可以用浏览器定位，也可以在地图上点选。设置后列表会显示每次地震离你多远，
  并标出 100 km 范围。位置只保存在你自己的浏览器里，不设置也能正常使用
- 点击列表或地图上的地震，可以看这次地震的详情：各观测点的震度分布图、按震度分组的市区町村、
  海啸说明，以及离"我的位置"最近的观测点测到的震度
- 可以叠加南海海槽巨大地震设想震源区的大致轮廓
- 界面支持中文、日本語、English，首次打开按浏览器语言自动选择，可以在右上角切换。
  英文界面使用气象厅提供的英文地名

在线版：<https://earthquake-radar.pages.dev>

## 本地运行

没有构建步骤，也没有依赖要装。页面用的是浏览器原生的 ES modules，
双击 `index.html`（`file://`）打不开，需要在本目录起一个静态服务器：

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 目录结构

```
index.html        页面结构
css/style.css     样式（浅色 / 深色）
js/main.js        入口：页面状态、事件绑定、定时刷新
js/config.js      常量：数据地址、震度配色、地图视角、默认位置
js/data.js        读取并合并气象厅的地震报告
js/map.js         Leaflet 地图、震源圆点、南海海槽轮廓、图例
js/ui.js          右侧面板：统计、列表、按钮
js/home.js        "我的位置"的读取和保存
js/nankai.js      南海海槽设想震源区的近似坐标
js/i18n.js        三种语言的界面文字，以及时间、深度、地名的本地化
js/util.js        距离计算等通用小工具
```

## 部署

部署在 Cloudflare Pages：连接本仓库，Framework preset 选 None，
Build command 留空，Build output directory 填 `/`。推送到 `main` 会自动部署。

## 数据来源

- 地震数据：[气象厅 防災情報 JSON](https://www.jma.go.jp/bosai/quake/data/list.json)，各地震度来自同目录下每次地震的详细报告（[地震情報](https://www.jma.go.jp/bosai/map.html#contents=earthquake_map)）
- 底图：[国土地理院 淡色地図](https://maps.gsi.go.jp/development/ichiran.html)
- 地图库：[Leaflet](https://leafletjs.com/) 1.9.4

南海海槽设想震源区是参照内阁府（2012 年）的原图手工描出的近似轮廓，只用于示意，
准确范围请以[气象厅](https://www.jma.go.jp/jma/kishou/know/jishin/nteq/assumption.html)和内阁府发布的资料为准。

本页面不是官方信息。地震发生时请以气象厅、NHK 和所在自治体发布的信息为准。
