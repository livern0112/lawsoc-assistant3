// Google Apps Script — Notion API Proxy for 小璦 (lawsoc-assistant3)
//
// 部署步驟：
// 1. 前往 https://script.google.com 建立新專案，貼上此檔案內容
// 2. 點選「部署」→「新增部署作業」→ 類型選「Web 應用程式」
// 3. 執行者：選「我」；存取權：選「所有人」（Anyone）
// 4. 部署後複製 Web App URL，貼入小璦設定面板的「GAS Proxy URL」欄位
//
// 每次修改程式碼後，需重新部署（選「新版本」）才會生效

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Endpoint 白名單：只允許 app 實際需要的三種呼叫
const ALLOWED_ENDPOINTS = [
  /^\/search$/,
  /^\/databases\/[a-f0-9\-]{32,36}\/query$/,
  /^\/blocks\/[a-f0-9\-]{32,36}\/children$/,
];

function isAllowedEndpoint(endpoint) {
  return ALLOWED_ENDPOINTS.some(function(pattern) {
    return pattern.test(endpoint);
  });
}

function proxyToNotion(endpoint, method, token, bodyObj) {
  if (!token) {
    return { error: true, message: 'Missing Notion token', status: 401 };
  }
  if (!endpoint || !isAllowedEndpoint(endpoint)) {
    return { error: true, message: 'Endpoint not allowed: ' + endpoint, status: 403 };
  }

  var url = NOTION_BASE + endpoint;
  var options = {
    method: method.toLowerCase(),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Notion-Version': NOTION_VERSION
    },
    muteHttpExceptions: true
  };

  if (bodyObj && (method === 'POST' || method === 'PATCH')) {
    options.payload = JSON.stringify(bodyObj);
  }

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var parsed;

  try {
    parsed = JSON.parse(response.getContentText());
  } catch (e) {
    return { error: true, message: 'Invalid JSON from Notion', status: code };
  }

  if (code >= 400) {
    return { error: true, status: code, notionError: parsed };
  }

  return parsed;
}

// doGet：處理 GET 請求（例如 /blocks/{id}/children）
// 前端透過 query string 傳入 endpoint 和 token
function doGet(e) {
  var params = e.parameter || {};
  var endpoint = params.endpoint || '';
  var token = params.token || '';

  var result = proxyToNotion(endpoint, 'GET', token, null);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// doPost：處理 POST 請求（/search, /databases/{id}/query）
// 前端透過 JSON body 傳入 endpoint、method、token、body
// 注意：前端必須使用 Content-Type: text/plain 避免 CORS preflight
// GAS 不支援 OPTIONS 請求，text/plain 屬於 simple request 不會觸發 preflight
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    body = {};
  }

  var endpoint = body.endpoint || '';
  var method = (body.method || 'POST').toUpperCase();
  var token = body.token || '';
  var payload = body.body || null;

  var result = proxyToNotion(endpoint, method, token, payload);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
