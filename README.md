# 震源速览 · Earthquake Radar

一个纯静态网页（无构建步骤），把日本气象厅（JMA）公开的地震信息画在地图上：

- 最近约 30 天的有感地震，圆点颜色是气象厅的震度配色，大小对应震级
- 每 60 秒自动更新，新地震带"新"标记，最新一次地震有闪烁圆圈
- 按时间（24 小时 / 7 天 / 全部）和最大震度筛选
- "我的位置"是可选的：可以用浏览器定位，也可以在地图上点选。设置后列表会显示每次地震离你多远，
  并标出 100 km 范围。位置只保存在你自己的浏览器里，不设置也能正常使用
- 点击列表或地图上的地震，可以看这次地震的详情：各观测点的震度分布图、按震度分组的市区町村、
  海啸说明，以及离"我的位置"最近的观测点测到的震度
- 可以切换到 **USGS** 数据：包括无感地震和海上地震，可以看最近 1 年，按最小震级筛选，颜色表示震源深度
- **南海海槽临时情报・海啸**：标题下方一直显示两项状态。南海海槽地震临时情报（巨大地震警戒／注意／调查中／调查结束）
  来自气象厅防灾信息 XML（约最近7天）；海啸警报・注意报・预报发布时，地图沿岸按等级上色，点开可看各区域的预计高度和第一波时间，
  以及最近约30天的海啸信息
- **避难场所**：国土地理院的指定紧急避难场所，可按地震、海啸、大火、洪水切换，放大到街区级别时显示，
  鼠标移上去可看名称、地址和适用的灾害
- **海啸浸水设想**：重ねるハザードマップ的海啸浸水深（设想最大级别），按全国统一图例着色。部分都道府县没有数据
- **长周期地震动**：气象厅发布了长周期地震动阶级（1～4）的地震，在列表里带"长周期N"标记；
  详情里显示阶级的含义、测到阶级1以上的观测点和 Sva，地图上用编号方块标出这些观测点
- **余震分析**：地震详情里统计震中附近、主震之后的地震次数和最大余震，画出震级-时间图（M-T 图），
  地图上用空心圆标出余震
- **深度剖面图**：地图左上角的"剖面"按钮。选预设（日本海沟、千岛海沟、南海海槽、伊豆・小笠原海沟）
  或在地图上画一条线，把线两侧的震源按距离和深度画成剖面，可以看到俯冲板块的形状。
  配合 USGS · 1年的数据效果最好
- 地图图层：南海海槽（设想震源区或按 1707 / 1854 / 1944・1946 破裂历史划分的三段，二选一）、
  板块边界（俯冲带、海沟和板块名称）、1891 年以来的历史大地震、地震密度热力图。
  "地图设置"可以折叠，折叠后标题旁仍显示当前底图和图层数
- 底图可以在淡色、标准、航拍、地形（色别标高）之间切换。淡色和标准是国土地理院的**矢量地图**，
  地名、河川・湖泊、道路、铁路、行政界、建筑物、等高线可以分别开关；航拍和地形上也会叠加选中的要素
- 浅色／深色主题：默认跟随系统，也可以在右上角手动选择"浅色"或"深色"（会记住）
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
js/usgs.js        读取 USGS 地震目录（日本周边）
js/map.js         Leaflet 地图、震源圆点、南海海槽轮廓、图例
js/basemap.js     底图：国土地理院矢量地图（MapLibre）和栅格底图，地图要素开关
js/ui.js          右侧面板：统计、列表、按钮
js/home.js        "我的位置"的读取和保存
js/nankai.js      南海海槽设想震源区的近似坐标
data/plates.json  日本周边的板块边界（从 PB2002 裁剪）
data/historic.json 历史大地震（震中、震级、伤亡人数、简介，三种语言）
js/i18n.js        三种语言的界面文字，以及时间、深度、地名的本地化
js/analysis.js    余震搜索、深度剖面的投影计算和预设剖面线
js/charts.js      SVG 图表：M-T 图和深度剖面图
js/alerts.js      南海海槽临时情报、海啸信息的读取和分级
js/util.js        距离计算等通用小工具
```

## 部署

部署在 Cloudflare Pages：连接本仓库，Framework preset 选 None，
Build command 留空，Build output directory 填 `/`。推送到 `main` 会自动部署。

## 数据来源

- 海啸：气象厅 `bosai/tsunami/data/`，沿岸区域形状来自 `bosai/common/const/geojson/tsunami.json`
- 南海海槽地震临时情报：[气象厅防灾信息 XML](https://xml.kishou.go.jp/)（`eqvol_l.xml` 长期 feed）
- 指定紧急避难场所：[国土地理院](https://www.gsi.go.jp/bousaichiri/hinanbasho.html)（`skhbNN` GeoJSON 瓦片）
- 海啸浸水设想：出典：[ハザードマップポータルサイト](https://disaportal.gsi.go.jp/)（`04_tsunami_newlegend_data`）
- 长周期地震动：[气象厅 長周期地震動に関する観測情報](https://www.data.jma.go.jp/eew/data/ltpgm/)（`bosai/ltpgm/data/list.json` 及各次报告）
- 地震数据：[气象厅 防災情報 JSON](https://www.jma.go.jp/bosai/quake/data/list.json)，各地震度来自同目录下每次地震的详细报告（[地震情報](https://www.jma.go.jp/bosai/map.html#contents=earthquake_map)）
- USGS 地震目录：[FDSN Event Web Service](https://earthquake.usgs.gov/fdsnws/event/1/)，日本周边大约 M4 以上较完整
- 底图：[国土地理院 最適化ベクトルタイル](https://github.com/gsi-cyberjapan/optimal_bvmap)（标准地图风格，淡色版由页面调色生成）、
  [地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)（航拍、色别标高，以及浏览器不支持矢量地图时的备用底图）
- 矢量地图渲染：[MapLibre GL JS](https://maplibre.org/) 4.7.1、[PMTiles](https://github.com/protomaps/PMTiles)、[maplibre-gl-leaflet](https://github.com/maplibre/maplibre-gl-leaflet)
- 地图库：[Leaflet](https://leafletjs.com/) 1.9.4

历史大地震的震中、震级和伤亡人数是常见引用值的概数，仅供参考。热力图使用 [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat)。

板块边界来自 Bird, P. (2003) 的 PB2002 模型，经 [fraxen/tectonicplates](https://github.com/fraxen/tectonicplates)
整理为 GeoJSON（Open Data Commons Attribution License），本仓库只保留了日本周边的部分。
板块和海沟名称的位置是手工标注的。

南海海槽设想震源区是参照内阁府（2012 年）的原图手工描出的近似轮廓，只用于示意，
准确范围请以[气象厅](https://www.jma.go.jp/jma/kishou/know/jishin/nteq/assumption.html)和内阁府发布的资料为准。

本页面不是官方信息。地震发生时请以气象厅、NHK 和所在自治体发布的信息为准。
