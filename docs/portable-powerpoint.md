# 跨平台原生 PowerPoint 匯出

## 現在可用的部分

網頁版 v94 的 **專案與匯出 → 匯出選取 PPTX（跨平台原生物件）**，可以直接在瀏覽器產生 `.pptx`，不需要安裝 Windows 連接元件、登入或上傳圖稿。

1. 在 Skechu 選取要輸出的物件。
2. 按 **匯出選取 PPTX**。
3. 用 PowerPoint 開啟檔案，點圖頁內的物件，再全選、複製到自己的簡報。不要選左邊的圖頁縮圖。

Windows 桌面版用 Ctrl+A / Ctrl+C / Ctrl+V；Mac 桌面版用 Cmd+A / Cmd+C / Cmd+V。Mac 和 Linux／Ubuntu 的瀏覽器可以產生相同的原生檔案；Linux 可用網頁版 PowerPoint 開啟。這些接收端的實際貼上、字型及編輯能力仍需逐平台驗證，不表示任意程式都能原生貼上。

現有 Windows 連接元件的 Ctrl+C 直接複製流程保持不變。非 Windows 按複製時，會說明目前需經過 PPTX，不會顯示 Windows 安裝包、宣稱已寫入剪貼簿，或自動下載。

## 自動識別系統

預設依瀏覽器提供的系統資料自動分流：Windows 使用直接複製連接元件，Mac、Linux／Ubuntu、ChromeOS、iPhone／iPad、Android 使用 PPTX 匯出說明。未識別的系統也先使用不需連接元件的匯出方式；非 Windows 就算開在 localhost，也不會背景探測或準備 Windows Office。

**專案與匯出** 選單會顯示辨識結果。展開後可手動改成 **Windows 連接元件** 或 **跨平台 PPTX 匯出**，設定只記在這個瀏覽器，不改動圖稿。切換本身不會安裝、下載或複製。

系統辨識只是操作提示，不表示偵測到已安裝的 PowerPoint。瀏覽器可能縮減或偽裝平台資訊，[`userAgentData` 並非所有瀏覽器都有](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData)，而 [`platform` 也不能保證辨識可靠](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform)。iPad 桌面網站模式另採 Mac 平台＋觸控點的啟發式判斷；若判錯請手動切換。

## 保留與限制

- 原有三次 Bézier 曲線及手把直接轉成 DrawingML，不重新描圖或簡化。封閉輪廓使用各自的 moveTo / close，不把挖洞接成斜線。
- 平塗與 2–10 個色標的線性漸層、色標透明度、角度均保持原生可編輯。沿用編輯器的填色／線稿順序。
- 一般文字保持文字。字型須存在於接收端，跨系統排版不保證逐像素相同。
- 箭頭尖端沿用網頁的形狀和大小，輸出為獨立可編輯小路徑。
- 參考底圖、隱藏物件不輸出。LaTeX 及非參考圖片等尚未支援的類型會阻止整次匯出，不會偷偷省略或轉成圖片。
- 匯出一次最多 5,000 個來源物件、50,000 個來源錨點；原生包最多 10,000 個形狀、100,000 段曲線、24 MB。打包在專用 Worker 中執行，逾時會明確失敗。
- 直接開啟 `file://` HTML 只能匯出至多 100 個展開形狀。大量物件請使用網頁服務。
- 此功能不會讀取或寫入系統剪貼簿，不會啟動 Office、安裝元件或連到任何遠端轉檔服務。

## 尚未完成：所有系統直接貼到目前圖頁

原生 PPTX 檔案不是跨平台通用的原生剪貼簿格式。Office.js 的 [`insertSlidesFromBase64`](https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/insert-slides-into-presentation) 可以匯入完整圖頁，但不是把任意曲線貼入目前圖頁；目前的 [`ShapeCollection`](https://learn.microsoft.com/en-us/javascript/api/powerpoint/powerpoint.shapecollection?view=powerpoint-js-preview) 也沒有通用的自訂 Bézier 建立介面。

因此還沒有把「下載 PPTX」包裝成「直接貼上完成」。下一階段需確認接收端方案：接受增益集匯入新圖頁，或繼續研究原生剪貼簿／桌面接收元件。增益集沒有在這版安裝、上架或取得使用者文件權限。

## 已做的驗證

- `node tests/check_portable_pptx.mjs`：封閉／開放曲線、獨立挖洞、漸層色標與透明度、文字 escaping、旋轉、非法輸入、無原稿變更、無媒體或外部關係。
- `node tests/check_ppt_platform.mjs`：17 種平台資訊、iPad 桌面模式、未知平台、手動修正及不觸發背景 Office 的檢查。
- `python tests/check_portable_pptx_native.py`：ZIP CRC 與所有 XML 檔案。
- `node tests/check_portable_pptx_browser.mjs`：真實 Chrome 的 Worker／下載／手機尺寸 UI；Mac、Linux 平台標記是模擬，**不是 Mac 或 Linux 實機驗證**。
- `python tests/check_portable_pptx_native.py --office`：僅在有 PowerPoint 的 Windows 測試機，開啟獨立測試簡報，實際修改曲線節點及漸層色標，再匯出檢查。`--browser` 檢查網頁下載的選取結果。測試不碰使用者剪貼簿或既有簡報。

QA 產物只留在 `.codex-tmp/portable-pptx-qa/`，不隨網站發布。
