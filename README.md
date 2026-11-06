# 蘇菲の歌單 ࿐

這是以 NIAN 原始專案為底稿修改的 GitHub Pages 歌單網站。**保留原始版型尺寸、卡片排列、間距、斷點、搜尋／分類／隨機抽歌／複製互動**，僅替換指定品牌文字、裝飾圖示、背景與 Google 試算表來源。

## 原版版型保留

- 頁面最大寬度：**1180px**
- 歌曲卡片最低高度：**150px**
- 卡片最小欄寬：**230px**
- 卡片欄距：**18px**
- 桌機／手機斷點、Hero 區、搜尋列、分類按鈕、歌卡、隨機抽歌視窗與頁尾配置均沿用原始 CSS。
- 桌機及手機背景改為你提供的紫黑星空圖（手機版由同一張圖製作直式裁切）。
- 歌曲卡片以深紫為主，加入低飽和藍紫、莓果玫瑰與暖香檳色輪替點綴，並同步調整分類標籤、裝飾圖示底色及複製按鈕，維持夜空主題且增加卡片層次。
- 原小魚圖示改為 **࿐**，用於頁首、歌曲卡片、隨機抽歌視窗、Favicon 及 iOS 圖示。
- 網站名稱固定為「蘇菲の歌單」；若試算表舊設定含「年年」字樣，顯示時也會替換為「蘇菲」。

## Google 試算表

<https://docs.google.com/spreadsheets/d/14yDYJOUYt0TU0DE8Pr-bUxGAazjDrk4HJ1zRZjNvl28/edit?usp=sharing>

目前讀取第一個工作表（gid=0），欄位格式沿用原專案：

| 欄位 | 說明 |
|---|---|
| A | 歌名（必填） |
| B | 歌手 |
| C | 歌曲分類 |
| D | 歌曲連結（若為 http/https 網址才會啟用雙擊開啟） |
| F | 分類標籤清單 |
| H、I | 設定名稱與設定值；小標題可用「網站小標題」、「網站副標題」或「小標題」 |

以下四項文字全部由試算表控制：**網站標題、網站小標題、抽歌視窗標題、關閉按鈕文字**。設定讀取支援兩種格式：設定名稱與設定內容分別放在相鄰儲存格（原表使用 H 欄名稱、I 欄內容）；或同一格輸入「網站標題：蘇菲の歌單」這種「名稱：內容」格式。若某項沒有填寫，才使用網站內建預設文字。

請將試算表共用權限設為「知道連結的任何人 → 檢視者」。

## 最新資料與快取處理

- 每次開啟頁面都重新向 Google 試算表取得資料，使用唯一時間參數避免沿用舊回應。
- 頁面開啟期間每 **45 秒**重新檢查；切回分頁、瀏覽器視窗重新取得焦點、從頁面快取恢復時也會重新讀取。
- 不把先前歌曲存成離線備援；資料讀取失敗時清空歌曲卡片並顯示錯誤，不會以舊資料冒充最新內容。
- 不註冊 Service Worker，並會解除本網站路徑下既有的 Service Worker，清除舊版網站快取。
- CSS、JS、圖示及背景圖均更新版本參數，避免沿用舊檔案。
- GitHub Pages 與 Google 試算表仍可能有平台端短暫傳播時間；靜態網站無法保證全球節點在更新同一秒同步，但前端不會主動回退顯示舊歌單。

## GitHub Pages 部署

1. 解壓縮 ZIP。
2. 將 ZIP 內的 `index.html`、`style.css`、`script.js`、`copyright.html`、`.nojekyll` 與 `assets` 資料夾直接放到 Repository **根目錄**，不要再多包一層資料夾。
3. Repository → **Settings → Pages**。
4. Build and deployment 選 **Deploy from a branch**。
5. Branch 選 `main`，資料夾選 `/(root)`，按 Save。

## 檔案

```text
index.html
style.css
script.js
copyright.html
.nojekyll
assets/
  nian-bg-desktop.webp
  nian-bg-mobile.webp
  sophie-ornament.svg
  favicon-192.png
  apple-touch-icon.png
```

版權行依需求保留：**© 2026 LionLionTomato. All Rights Reserved.**
