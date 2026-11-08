// Interface language: Chinese, Japanese and English strings, plus the
// language-dependent formatting of times, depths, magnitudes and place names.

const LANGS = ["zh", "ja", "en"];
const LANG_KEY = "quake-radar.lang";
const HTML_LANG = { zh: "zh-CN", ja: "ja", en: "en" };
const LOCALE = { zh: "zh-CN", ja: "ja-JP", en: "en-GB" };

// Intensity class names as each language writes them.
const INT_LABEL = {
  zh: { "5-": "5弱", "5+": "5强", "6-": "6弱", "6+": "6强" },
  ja: { "5-": "5弱", "5+": "5強", "6-": "6弱", "6+": "6強" },
  en: { "5-": "5−", "5+": "5+", "6-": "6−", "6+": "6+" },
};

const USGS_LINK = '<a href="https://earthquake.usgs.gov/earthquakes/map/" target="_blank" rel="noopener">';
const JMA_LINK = '<a href="https://www.jma.go.jp/bosai/map.html#contents=earthquake_map" target="_blank" rel="noopener">';

const STRINGS = {
  zh: {
    title: "震源速览",
    asTitle: "余震", asCount: "{n} 次", asScope: "震中 {r} km 以内、主震之后",
    asLargest: "最大余震：{q}（{ago}）", asNone: "目前这个范围内还没有记录到余震。",
    asLimitJma: "气象厅数据只包括有感地震（震度1以上），最多约30天。",
    asLimitUsgs: "USGS 数据只包括当前时间范围和震级筛选内的地震，日本附近约 M4 以上较完整。",
    asAdvice: "气象厅的一般建议：强烈摇晃后约1周内（特别是最初2～3天）要注意同等规模的地震。",
    mtAxisHours: "横轴：主震后经过的小时 · 竖线高度：震级 · 曲线：累计次数", mtAxisDays: "横轴：主震后经过的天数 · 竖线高度：震级 · 曲线：累计次数", mtCum: "累计{n}",
    profileBtn: "剖面", profileTitle: "深度剖面图", profilePresets: "预设", profileWidth: "宽度", profileLine: "剖面线",
    preTohoku: "东北・日本海沟", preKuril: "北海道・千岛海沟", preNankai: "纪伊半岛・南海海槽", preIzu: "伊豆・小笠原海沟",
    profileDraw: "在地图上画线", profileDrawingA: "在地图上点击起点 A…", profileDrawingB: "再点击终点 B…",
    profileHint: "A→B 线两侧各 {w} km 以内的震源，按到 A 的距离和深度排列",
    profileAxes: "横轴：距 A 的距离（km）· 纵轴：深度（km）", profileCount: "{n} 个震源", profileStretch: "深度方向放大约 {k} 倍",
    profileEmpty: "这条线附近没有震源。换一条线，或者放宽范围试试。",
    profileTip: "要看清俯冲板块的形状，需要更多的震源。建议切换到 USGS 数据的 1 年范围。",
    profileUseUsgs: "切换到 USGS · 1年",
    features: "地图要素", ftLabels: "地名", ftRivers: "河川・湖泊", ftRoads: "道路", ftRail: "铁路", ftBoundaries: "行政界", ftBuildings: "建筑物", ftTerrain: "等高线",
    featuresUnavailable: "这个浏览器无法显示矢量地图，已改用普通地图，地图要素不能单独开关。",
    basemap: "底图", bmPale: "淡色", bmStd: "标准", bmPhoto: "航拍", bmRelief: "地形",
    layerSegments: "南海海槽分区", layerHistoric: "历史大地震", layerHeat: "密度热力图",
    mapSettings: "地图设置", nankaiLbl: "南海海槽", nkOff: "关闭", nkArea: "震源区", nkSegments: "历史分区", layersOn: "{n} 个图层", layerOne: "1 个图层", layersNone: "无图层",
    segNankai: "南海\n1707・1854・1946", segTonankai: "东南海\n1707・1854・1944", segTokai: "东海\n1707・1854（之后未破裂）",
    histInt: "最大震度{v}", toll: "死亡・失踪 约{n}人", tollPlus: "死亡 {n}人以上（含灾害关联死）",
    histApprox: "震央、震级和伤亡人数均为概略值",
    layers: "图层", layerNankai: "南海海槽震源区", layerPlates: "板块边界",
    platesKey: "板块边界：实线为俯冲带（海沟、海槽），虚线为其他边界",
    plPA: "太平洋板块", plPS: "菲律宾海板块", plOK: "鄂霍次克板块（北美板块）", plAM: "阿穆尔板块（欧亚板块）", plON: "冲绳板块",
    trKuril: "千岛海沟", trJapan: "日本海沟", trIzu: "伊豆・小笠原海沟", trNankai: "南海海槽", trRyukyu: "琉球海沟",
    source: "数据源", srcJma: "气象厅", srcUsgs: "USGS",
    subtitleUsgs: "USGS 地震目录 · 日本周边 · 颜色为震源深度 · 日本附近约 M4 以上较完整",
    minMag: "最小震级", pYear: "1年", scopeYear: "最近1年",
    legendDepth: "震源深度（km）· 圆越大震级越高",
    countMag: "{scope}M{m}以上的地震",
    deepest: "最深",
    jmaName: "气象厅", usgsName: "USGS",
    detailHintUsgs: "红叉是震央。USGS 没有日本各地的震度",
    tooltipUsgs: "<b>{place}</b> · {mag} · {depth}<br>{time}（{ago}）· 点击查看详情",
    usgsMagType: "震级类型：{t}",
    usgsReviewed: "已人工复核", usgsAutomatic: "自动测定，之后可能修正",
    usgsFelt: "{n} 人在 USGS「Did You Feel It?」报告感觉到摇晃",
    usgsTsunami: "USGS 给这次地震加了海啸标记（表示可能有海啸相关信息）。日本的海啸信息请以气象厅为准。",
    usgsAlert: "PAGER 灾害评估等级：{level}",
    usgsLink: "在 USGS 网站查看详情",
    usgsNote: "USGS 的震级和位置可能与气象厅不同。日本各地的震度和海啸信息请以气象厅为准。",
    usgsSource: "USGS 地震目录",
    subtitle: "气象厅有感地震 · 最近约30天 · 颜色为各地观测到的最大震度",
    loading: "正在读取{src}数据…",
    loadingList: "正在读取…",
    refresh: "刷新",
    mapAria: "地震分布地图",
    period: "时间范围", p24: "24小时", p168: "7天", pAll: "30天",
    minInt: "最大震度", all: "全部", min3: "3以上", min4: "4以上", min5: "5弱以上",
    view: "地图视角", vJp: "全国", vTokai: "东海・南海", vHome: "我的位置周边",
    home: "我的位置", homeSet: "已设置", homeUnset: "未设置",
    locate: "使用当前位置", pick: "在地图上选择", picking: "点击地图上的位置…", clear: "清除",
    locating: "正在获取…", homeFirst: "先设置我的位置",
    geoUnsupported: "这个浏览器不支持获取位置",
    geoDenied: "没有获得位置权限，可以改用「在地图上选择」",
    geoTimeout: "获取位置超时，请再试一次",
    geoFailed: "无法获取当前位置",
    nankai: "显示南海海槽设想震源区（大致示意）",
    listAria: "地震列表",
    back: "← 返回列表",
    detailHint: "地图上的圆点是各观测点，红叉是震央",
    foot: `数据：${JMA_LINK}气象厅</a>、${USGS_LINK}USGS</a>（自动更新）· 底图：国土地理院 · 南海海槽范围按内阁府原图手工描绘，仅供参考 · 板块边界：Bird (2003)`,
    legend: "最大震度 · 圆越大震级越高",
    attribution: "国土地理院",
    updated: "更新于 {t}",
    fresh: "有{n}次新地震 · ",
    loadFailed: "无法读取{src}数据，稍后自动重试",
    unknownPlace: "震源不明",
    magUnknown: "M不明",
    depthUnknown: "深度不明", depthShallow: "极浅", depth: "深{d}km",
    justNow: "刚刚", minAgo: "{n}分钟前", hourAgo: "{n}小时前", dayAgo: "{n}天前",
    int: "震度{v}",
    tooltip: "<b>{place}</b> · {mag} · 最大震度{int}<br>{time}（{ago}）· 点击查看各地震度",
    whenAgo: "{time}（{ago}）",
    coords: "北纬{lat} 东经{lon}",
    distFromMe: "距我的位置约 {d} km",
    loadingDetail: "正在读取各地震度…",
    noDetail: "气象厅没有发布这次地震各地的震度。",
    detailFailed: "无法读取这次地震的各地震度，请稍后再试。",
    nearestLbl: "离我的位置最近的观测点",
    nearestText: "{name}（约 {d} km）：震度{int}",
    nearbyLbl: "我的位置附近",
    nearbyNone: "{km} km 以内没有观测点记录到震度1以上，那里应该基本感觉不到。",
    noCities: "这次报告里没有各地的震度。",
    groupsTitle: "各地震度 · {c} 个市区町村 · {s} 个观测点",
    fold: "{c} 个市区町村，{p} 个都道府县（展开）",
    nameSep: "、",
    scope24: "最近24小时", scope168: "最近7天", scopeAll: "最近30天",
    countFelt: "{scope}有感地震",
    countMin: "{scope}震度{v}以上的地震",
    strongest: "摇得最强", largest: "震级最大",
    nearCount: "震源在我的位置{km}km内",
    latest: "最新一次",
    chipTitle: "最大震度",
    emptyFiltered: "这个范围内没有符合条件的地震。换一个时间范围或震度试试。",
    emptyNone: "暂时没有数据。",
    listDist: " · 距我{d}km",
    epicenter: "震央",
    station: "{name} · 震度{int}",
  },
  ja: {
    title: "地震レーダー",
    asTitle: "余震", asCount: "{n} 回", asScope: "震央から {r} km 以内・本震以降",
    asLargest: "最大余震：{q}（{ago}）", asNone: "この範囲ではまだ余震は記録されていません。",
    asLimitJma: "気象庁のデータは有感地震（震度1以上）のみ・最大約30日分です。",
    asLimitUsgs: "USGSのデータは現在の期間とマグニチュードの条件に入る地震のみです。日本付近はおおむねM4以上がそろっています。",
    asAdvice: "気象庁の一般的な呼びかけ：強い揺れのあと1週間程度（特に最初の2〜3日）は同程度の地震に注意してください。",
    mtAxisHours: "横軸：本震からの経過時間（時間）・縦線の高さ：マグニチュード・曲線：累積回数", mtAxisDays: "横軸：本震からの経過日数・縦線の高さ：マグニチュード・曲線：累積回数", mtCum: "累計{n}",
    profileBtn: "断面", profileTitle: "震源の深さ断面", profilePresets: "プリセット", profileWidth: "幅", profileLine: "断面線",
    preTohoku: "東北・日本海溝", preKuril: "北海道・千島海溝", preNankai: "紀伊半島・南海トラフ", preIzu: "伊豆・小笠原海溝",
    profileDraw: "地図に線を引く", profileDrawingA: "地図で始点 A をクリック…", profileDrawingB: "続けて終点 B をクリック…",
    profileHint: "A→B の線から両側 {w} km 以内の震源を、A からの距離と深さで並べています",
    profileAxes: "横軸：A からの距離（km）・縦軸：深さ（km）", profileCount: "震源 {n} 個", profileStretch: "深さ方向を約 {k} 倍に拡大",
    profileEmpty: "この線の近くに震源はありません。線や幅を変えてみてください。",
    profileTip: "沈み込むプレートの形を見るには、もっと多くの震源が必要です。USGS・1年に切り替えるのがおすすめです。",
    profileUseUsgs: "USGS・1年に切り替え",
    features: "地図の表示", ftLabels: "地名", ftRivers: "河川・湖沼", ftRoads: "道路", ftRail: "鉄道", ftBoundaries: "行政界", ftBuildings: "建物", ftTerrain: "等高線",
    featuresUnavailable: "このブラウザではベクトル地図を表示できないため、通常の地図に切り替えました。表示の切り替えは使えません。",
    basemap: "背景地図", bmPale: "淡色", bmStd: "標準", bmPhoto: "写真", bmRelief: "地形",
    layerSegments: "南海トラフ区分", layerHistoric: "過去の大地震", layerHeat: "地震の密度",
    mapSettings: "地図の設定", nankaiLbl: "南海トラフ", nkOff: "非表示", nkArea: "想定震源域", nkSegments: "区分", layersOn: "レイヤー {n}", layerOne: "レイヤー 1", layersNone: "レイヤーなし",
    segNankai: "南海\n1707・1854・1946", segTonankai: "東南海\n1707・1854・1944", segTokai: "東海\n1707・1854（以降なし）",
    histInt: "最大震度{v}", toll: "死者・行方不明 約{n}人", tollPlus: "死者 {n}人以上（災害関連死を含む）",
    histApprox: "震央・規模・犠牲者数はいずれも概数です",
    layers: "レイヤー", layerNankai: "南海トラフ震源域", layerPlates: "プレート境界",
    platesKey: "プレート境界：実線は沈み込み帯（海溝・トラフ）、破線はその他の境界",
    plPA: "太平洋プレート", plPS: "フィリピン海プレート", plOK: "オホーツクプレート（北米プレート）", plAM: "アムールプレート（ユーラシアプレート）", plON: "沖縄プレート",
    trKuril: "千島海溝", trJapan: "日本海溝", trIzu: "伊豆・小笠原海溝", trNankai: "南海トラフ", trRyukyu: "琉球海溝",
    source: "データ元", srcJma: "気象庁", srcUsgs: "USGS",
    subtitleUsgs: "USGS地震カタログ・日本周辺・色は震源の深さ・日本付近はおおむねM4以上がそろっています",
    minMag: "最小規模", pYear: "1年", scopeYear: "直近1年",
    legendDepth: "震源の深さ（km）・円が大きいほどマグニチュードが大きい",
    countMag: "{scope}のM{m}以上の地震",
    deepest: "最も深い",
    jmaName: "気象庁", usgsName: "USGS",
    detailHintUsgs: "赤い×は震央です。USGSには各地の震度はありません",
    tooltipUsgs: "<b>{place}</b>・{mag}・{depth}<br>{time}（{ago}）・クリックで詳細",
    usgsMagType: "マグニチュードの種類：{t}",
    usgsReviewed: "確認済み", usgsAutomatic: "自動決定（あとで修正される場合があります）",
    usgsFelt: "USGS「Did You Feel It?」で {n} 件の有感報告",
    usgsTsunami: "USGSはこの地震に津波フラグを付けています（津波関連情報がある可能性）。日本の津波情報は気象庁の発表を確認してください。",
    usgsAlert: "PAGER 被害推定レベル：{level}",
    usgsLink: "USGSのサイトで詳細を見る",
    usgsNote: "USGSのマグニチュードや震源は気象庁と異なることがあります。日本各地の震度や津波情報は気象庁の発表を確認してください。",
    usgsSource: "USGS地震カタログ",
    subtitle: "気象庁の有感地震・直近約30日・色は各地で観測された最大震度",
    loading: "{src}のデータを読み込み中…",
    loadingList: "読み込み中…",
    refresh: "更新",
    mapAria: "地震の分布図",
    period: "期間", p24: "24時間", p168: "7日", pAll: "30日",
    minInt: "最大震度", all: "すべて", min3: "3以上", min4: "4以上", min5: "5弱以上",
    view: "表示範囲", vJp: "全国", vTokai: "東海・南海", vHome: "マイ地点周辺",
    home: "マイ地点", homeSet: "設定済み", homeUnset: "未設定",
    locate: "現在地を使う", pick: "地図で選ぶ", picking: "地図をクリックしてください…", clear: "解除",
    locating: "取得中…", homeFirst: "先にマイ地点を設定してください",
    geoUnsupported: "このブラウザは位置情報に対応していません",
    geoDenied: "位置情報が許可されませんでした。「地図で選ぶ」を使ってください",
    geoTimeout: "位置情報の取得がタイムアウトしました。もう一度お試しください",
    geoFailed: "現在地を取得できませんでした",
    nankai: "南海トラフ巨大地震の想定震源域を表示（概略）",
    listAria: "地震の一覧",
    back: "← 一覧に戻る",
    detailHint: "地図の点は各観測点、赤い×は震央です",
    foot: `データ：${JMA_LINK}気象庁</a>・${USGS_LINK}USGS</a>（自動更新）・地図：国土地理院・南海トラフの範囲は内閣府の図をもとにした概略です・プレート境界：Bird (2003)`,
    legend: "最大震度・円が大きいほどマグニチュードが大きい",
    attribution: "国土地理院",
    updated: "{t} 更新",
    fresh: "新しい地震 {n} 件・",
    loadFailed: "{src}のデータを取得できません。しばらくして再試行します",
    unknownPlace: "震源不明",
    magUnknown: "M不明",
    depthUnknown: "深さ不明", depthShallow: "ごく浅い", depth: "深さ{d}km",
    justNow: "たった今", minAgo: "{n}分前", hourAgo: "{n}時間前", dayAgo: "{n}日前",
    int: "震度{v}",
    tooltip: "<b>{place}</b>・{mag}・最大震度{int}<br>{time}（{ago}）・クリックで各地の震度",
    whenAgo: "{time}（{ago}）",
    coords: "北緯{lat} 東経{lon}",
    distFromMe: "マイ地点から約 {d} km",
    loadingDetail: "各地の震度を読み込み中…",
    noDetail: "気象庁はこの地震の各地の震度を発表していません。",
    detailFailed: "この地震の各地の震度を取得できませんでした。しばらくしてからお試しください。",
    nearestLbl: "マイ地点に最も近い観測点",
    nearestText: "{name}（約 {d} km）：震度{int}",
    nearbyLbl: "マイ地点の周辺",
    nearbyNone: "{km} km 以内に震度1以上を観測した地点はありません。揺れはほとんど感じなかったはずです。",
    noCities: "この報告には各地の震度がありません。",
    groupsTitle: "各地の震度・{c} 市区町村・{s} 観測点",
    fold: "{c} 市区町村・{p} 都道府県（開く）",
    nameSep: "、",
    scope24: "直近24時間", scope168: "直近7日", scopeAll: "直近30日",
    countFelt: "{scope}の有感地震",
    countMin: "{scope}の震度{v}以上の地震",
    strongest: "最も強い揺れ", largest: "最大マグニチュード",
    nearCount: "マイ地点から{km}km以内",
    latest: "最新",
    chipTitle: "最大震度",
    emptyFiltered: "条件に合う地震はありません。期間や震度を変えてみてください。",
    emptyNone: "データがありません。",
    listDist: " · {d}km先",
    epicenter: "震央",
    station: "{name}・震度{int}",
  },
  en: {
    title: "Earthquake Radar",
    asTitle: "Aftershocks", asCount: "{n}", asScope: "within {r} km of the epicenter, after the mainshock",
    asLargest: "Largest: {q} ({ago})", asNone: "No aftershocks recorded in this area yet.",
    asLimitJma: "JMA data only has felt earthquakes (intensity 1+) from about the last 30 days.",
    asLimitUsgs: "USGS data only covers the current period and magnitude filter; near Japan it is fairly complete from about M4.",
    asAdvice: "JMA's usual advice: after strong shaking, watch for a quake of similar size for about a week, especially the first 2–3 days.",
    mtAxisHours: "Across: hours since the mainshock · stem height: magnitude · curve: running count", mtAxisDays: "Across: days since the mainshock · stem height: magnitude · curve: running count", mtCum: "Total {n}",
    profileBtn: "Profile", profileTitle: "Depth profile", profilePresets: "Presets", profileWidth: "Width", profileLine: "Line",
    preTohoku: "Tohoku · Japan Trench", preKuril: "Hokkaido · Kuril Trench", preNankai: "Kii · Nankai Trough", preIzu: "Izu–Bonin Trench",
    profileDraw: "Draw on map", profileDrawingA: "Click start point A on the map…", profileDrawingB: "Now click end point B…",
    profileHint: "Hypocenters within {w} km of the A→B line, by distance from A and depth",
    profileAxes: "Across: distance from A (km) · down: depth (km)", profileCount: "{n} hypocenters", profileStretch: "depth stretched about {k}×",
    profileEmpty: "No hypocenters near this line. Try another line or a wider band.",
    profileTip: "To see the shape of the sinking plate you need more hypocenters. Switching to USGS · 1 year works best.",
    profileUseUsgs: "Switch to USGS · 1 year",
    features: "Map features", ftLabels: "Names", ftRivers: "Rivers & lakes", ftRoads: "Roads", ftRail: "Railways", ftBoundaries: "Boundaries", ftBuildings: "Buildings", ftTerrain: "Contours",
    featuresUnavailable: "This browser can't draw the vector map, so a plain map is shown and features can't be switched.",
    basemap: "Base map", bmPale: "Light", bmStd: "Standard", bmPhoto: "Aerial", bmRelief: "Terrain",
    layerSegments: "Nankai segments", layerHistoric: "Historic quakes", layerHeat: "Density heatmap",
    mapSettings: "Map settings", nankaiLbl: "Nankai", nkOff: "Off", nkArea: "Source area", nkSegments: "Segments", layersOn: "{n} layers", layerOne: "1 layer", layersNone: "no layers",
    segNankai: "Nankai\n1707 · 1854 · 1946", segTonankai: "Tonankai\n1707 · 1854 · 1944", segTokai: "Tokai\n1707 · 1854 (none since)",
    histInt: "max intensity {v}", toll: "About {n} dead or missing", tollPlus: "More than {n} deaths (incl. disaster-related)",
    histApprox: "Epicenters, magnitudes and tolls are approximate",
    layers: "Layers", layerNankai: "Nankai source area", layerPlates: "Plate boundaries",
    platesKey: "Plate boundaries: solid = subduction (trench), dashed = other boundary",
    plPA: "Pacific Plate", plPS: "Philippine Sea Plate", plOK: "Okhotsk Plate (North American)", plAM: "Amur Plate (Eurasian)", plON: "Okinawa Plate",
    trKuril: "Kuril Trench", trJapan: "Japan Trench", trIzu: "Izu–Bonin Trench", trNankai: "Nankai Trough", trRyukyu: "Ryukyu Trench",
    source: "Source", srcJma: "JMA", srcUsgs: "USGS",
    subtitleUsgs: "USGS catalog · around Japan · color shows depth · fairly complete from about M4 near Japan",
    minMag: "Magnitude", pYear: "1 year", scopeYear: "last year",
    legendDepth: "Depth (km) · larger circle = larger magnitude",
    countMag: "M{m}+ earthquakes, {scope}",
    deepest: "Deepest",
    jmaName: "JMA", usgsName: "USGS",
    detailHintUsgs: "The red × is the epicenter. USGS has no Japanese intensities",
    tooltipUsgs: "<b>{place}</b> · {mag} · {depth}<br>{time} ({ago}) · click for details",
    usgsMagType: "Magnitude type: {t}",
    usgsReviewed: "Reviewed by a seismologist", usgsAutomatic: "Automatic solution, may be revised",
    usgsFelt: "{n} people reported feeling it on USGS “Did You Feel It?”",
    usgsTsunami: "USGS flagged this event for tsunami information. For tsunamis in Japan, follow JMA.",
    usgsAlert: "PAGER alert level: {level}",
    usgsLink: "View on the USGS website",
    usgsNote: "USGS magnitudes and locations can differ from JMA's. For intensities and tsunamis in Japan, follow JMA.",
    usgsSource: "USGS catalog",
    subtitle: "Felt earthquakes from JMA · last ~30 days · color shows the maximum observed intensity",
    loading: "Loading {src} data…",
    loadingList: "Loading…",
    refresh: "Refresh",
    mapAria: "Earthquake map",
    period: "Period", p24: "24 h", p168: "7 days", pAll: "30 days",
    minInt: "Intensity", all: "All", min3: "≥3", min4: "≥4", min5: "≥5−",
    view: "View", vJp: "Japan", vTokai: "Tokai–Nankai", vHome: "Near me",
    home: "My location", homeSet: "Set", homeUnset: "Not set",
    locate: "Locate me", pick: "Pick on map", picking: "Click the map…", clear: "Clear",
    locating: "Locating…", homeFirst: "Set your location first",
    geoUnsupported: "This browser can't share its location",
    geoDenied: "Location permission was denied. Use “Pick on map” instead",
    geoTimeout: "Getting your location timed out. Try again",
    geoFailed: "Couldn't get your location",
    nankai: "Show the Nankai Trough assumed source region (approx.)",
    listAria: "Earthquake list",
    back: "← Back to list",
    detailHint: "Dots are stations; the red × is the epicenter",
    foot: `Data: ${JMA_LINK}JMA</a>, ${USGS_LINK}USGS</a> (auto-refreshed) · Base map: GSI Japan · Nankai outline is hand-traced from the Cabinet Office map and approximate · Plate boundaries: Bird (2003)`,
    legend: "Max intensity · larger circle = larger magnitude",
    attribution: "GSI Japan",
    updated: "Updated {t}",
    fresh: "{n} new · ",
    loadFailed: "Couldn't load {src} data. Retrying shortly",
    unknownPlace: "Unknown epicenter",
    magUnknown: "M unknown",
    depthUnknown: "depth unknown", depthShallow: "very shallow", depth: "{d} km deep",
    justNow: "just now", minAgo: "{n} min ago", hourAgo: "{n} h ago", dayAgo: "{n} d ago",
    int: "Int. {v}",
    tooltip: "<b>{place}</b> · {mag} · max intensity {int}<br>{time} ({ago}) · click for local intensities",
    whenAgo: "{time} ({ago})",
    coords: "{lat}°N {lon}°E",
    distFromMe: "About {d} km from you",
    loadingDetail: "Loading local intensities…",
    noDetail: "JMA did not publish local intensities for this earthquake.",
    detailFailed: "Couldn't load local intensities. Try again shortly.",
    nearestLbl: "Nearest station to you",
    nearestText: "{name} (about {d} km): intensity {int}",
    nearbyLbl: "Around you",
    nearbyNone: "No station within {km} km recorded intensity 1 or more, so it was probably not felt there.",
    noCities: "This report has no local intensities.",
    groupsTitle: "Local intensities · {c} municipalities · {s} stations",
    fold: "{c} municipalities in {p} prefectures (show)",
    nameSep: ", ",
    scope24: "last 24 h", scope168: "last 7 days", scopeAll: "last 30 days",
    countFelt: "Felt earthquakes, {scope}",
    countMin: "Intensity {v}+ earthquakes, {scope}",
    strongest: "Strongest shaking", largest: "Largest magnitude",
    nearCount: "Within {km} km of you",
    latest: "Latest",
    chipTitle: "Max intensity",
    emptyFiltered: "No earthquakes match. Try another period or intensity.",
    emptyNone: "No data yet.",
    listDist: " · {d} km away",
    epicenter: "Epicenter",
    station: "{name} · intensity {int}",
  },
};

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch (_) { /* storage blocked */ }
  for (const l of navigator.languages || [navigator.language || ""]) {
    const code = l.toLowerCase().slice(0, 2);
    if (LANGS.includes(code)) return code;
  }
  return "en";
}

let lang = detect();
const listeners = [];

export const getLang = () => lang;

/** Change language, remember it, refresh static text and notify listeners. */
export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(LANG_KEY, next); } catch (_) { /* not remembered */ }
  applyStatic();
  for (const fn of listeners) fn(lang);
}

export const onLangChange = (fn) => listeners.push(fn);

/** Look up a string and fill {placeholders}. */
export function t(key, vars) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
}

/** Fill every element marked with data-i18n (text), data-i18n-html, -title or -aria. */
export function applyStatic() {
  document.documentElement.lang = HTML_LANG[lang];
  document.title = t("title");
  for (const n of document.querySelectorAll("[data-i18n]")) n.textContent = t(n.dataset.i18n);
  for (const n of document.querySelectorAll("[data-i18n-html]")) n.innerHTML = t(n.dataset.i18nHtml);
  for (const n of document.querySelectorAll("[data-i18n-aria]")) n.setAttribute("aria-label", t(n.dataset.i18nAria));
  for (const b of document.querySelectorAll("#lang button")) b.setAttribute("aria-pressed", String(b.dataset.v === lang));
}

// ---- formatting ----

export const intLabel = (maxi) => INT_LABEL[lang][maxi] || maxi || "–";

const fmtCache = {};
function formatter(kind) {
  const key = lang + kind;
  if (!fmtCache[key]) {
    const opts = kind === "clock"
      ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
      : { month: lang === "en" ? "short" : "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };
    fmtCache[key] = new Intl.DateTimeFormat(LOCALE[lang], { timeZone: "Asia/Tokyo", hour12: false, ...opts });
  }
  return fmtCache[key];
}
/** Times are always shown in Japan time, the zone JMA reports in. */
export const fmtTime = (d) => formatter("time").format(d);
export const fmtClock = (d) => formatter("clock").format(d);

export function ago(date) {
  const m = Math.round((Date.now() - date) / 60000);
  if (m < 1) return t("justNow");
  if (m < 60) return t("minAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 48) return t("hourAgo", { n: h });
  return t("dayAgo", { n: Math.floor(h / 24) });
}

export const depthText = (d) => (d == null ? t("depthUnknown") : d === 0 ? t("depthShallow") : t("depth", { d }));
export const magText = (m) => (m && !isNaN(+m) ? "M" + (+m).toFixed(1) : t("magUnknown"));

/** JMA gives Japanese names and English romanizations; English uses the latter. */
export const pick = (ja, en) => (lang === "en" && en ? en : ja);
export const placeName = (e) => pick(e.anm, e.anmEn) || t("unknownPlace");
