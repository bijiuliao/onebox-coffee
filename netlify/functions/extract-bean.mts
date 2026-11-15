import type { Config } from '@netlify/functions';
import { GoogleGenAI, Type } from '@google/genai';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

const FETCH_TIMEOUT_MS = 20000;
const MAX_HTML_CHARS = 500_000;
const MAX_TEXT_CHARS_FOR_PROMPT = 20_000;
// Below this many characters of extracted text, a page is almost certainly
// a JS-rendered shell or a bot-challenge interstitial rather than real
// product content - not literally empty, so the plain "no text at all"
// check wouldn't catch it, but too thin for Gemini to extract anything
// real from either.
const MIN_USABLE_TEXT_CHARS = 120;
// Content types that are unambiguously not a webpage - everything else
// (including a missing/unexpected content-type some CDNs send for real
// HTML) is allowed through, since blocking by allow-list was rejecting
// legitimate pages more often than it caught actual non-HTML responses.
const NON_HTML_CONTENT_TYPES = ['image/', 'video/', 'audio/', 'font/', 'application/pdf', 'application/zip', 'application/octet-stream'];
// Common phrases from bot-protection interstitials (Cloudflare, Akamai,
// Incapsula, PerimeterX, generic "enable JS" gates) - when the fetched
// text matches one of these, the request technically succeeded but what
// came back is a challenge page, not the product page, so it gets a
// specific, actionable error instead of being silently fed to Gemini.
const BOT_CHALLENGE_MARKERS = [
  'just a moment', 'checking your browser', 'enable javascript and cookies',
  'attention required', 'cf-browser-verification', 'verify you are a human',
  'ddos protection by', 'incapsula', 'perimeterx', 'are you a robot',
  '請驗證您是否為真人', '請開啟 javascript', '請啟用 javascript',
];

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: '咖啡豆品名，維持頁面上的原文語言' },
    originEN: { type: Type.STRING, description: '產地國家，英文全大寫，例如 ETHIOPIA。無法判斷則為空字串' },
    roast: { type: Type.STRING, description: '烘焙度，例如 淺焙 / 中焙 / 中深焙 / 深焙。無法判斷則為空字串' },
    notes: { type: Type.ARRAY, items: { type: Type.STRING }, description: '風味標籤，簡短詞彙陣列，例如 ["茉莉花","佛手柑"]' },
    process: { type: Type.STRING, description: '處理法，例如「水洗 Washed」。無法判斷則為空字串' },
    altitude: { type: Type.STRING, description: '海拔高度，例如「1,900–2,100m」。無法判斷則為空字串' },
    varietal: { type: Type.STRING, description: '品種，例如「原生種 Heirloom」。無法判斷則為空字串' },
    harvest: { type: Type.STRING, description: '採收季，例如「11–1 月」。無法判斷則為空字串' },
    roaster: { type: Type.STRING, description: '烘豆商或生產者名稱。無法判斷則為空字串' },
    desc: { type: Type.STRING, description: '簡短風味描述或故事，1-3 句話。無法判斷則為空字串' },
    price: { type: Type.NUMBER, nullable: true, description: '頁面上顯示的售價數字（新台幣）。找不到明確售價則為 null' },
  },
  required: ['name', 'originEN', 'roast', 'notes', 'process', 'altitude', 'varietal', 'harvest', 'roaster', 'desc', 'price'],
};

function htmlToText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return s.replace(/\s+/g, ' ').trim();
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'GEMINI_API_KEY is not configured on this site' }, 500);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!/^https?:\/\//i.test(url)) {
    return json({ error: '請提供有效的網址（需以 http:// 或 https:// 開頭）' }, 400);
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      // Mimics an ordinary browser request (not a self-identifying bot UA)
      // - this is a single on-demand fetch of a page an admin is actively
      // importing, not mass crawling, and most storefronts' bot-protection
      // only gates on exactly this kind of fingerprint (UA, Accept,
      // Accept-Language) rather than anything deeper.
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return json({ error: `無法讀取這個網址（伺服器回應 ${res.status}）` }, 400);

    const contentType = res.headers.get('content-type') || '';
    if (NON_HTML_CONTENT_TYPES.some(t => contentType.includes(t))) {
      return json({ error: '這個網址看起來不是網頁內容' }, 400);
    }
    html = (await res.text()).slice(0, MAX_HTML_CHARS);
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return json({ error: timedOut ? '讀取網頁逾時，請稍後再試' : '無法讀取這個網址' }, 400);
  }

  const pageText = htmlToText(html).slice(0, MAX_TEXT_CHARS_FOR_PROMPT);
  const lowerPageText = pageText.toLowerCase();
  if (BOT_CHALLENGE_MARKERS.some(m => lowerPageText.includes(m))) {
    return json({ error: '這個網站有防機器人驗證，自動抓取被擋下來了，請改用手動輸入' }, 400);
  }
  if (pageText.length < MIN_USABLE_TEXT_CHARS) {
    return json({ error: '這個網頁幾乎沒有抓到文字內容（可能整頁都是用 JavaScript 動態產生的），請改用手動輸入' }, 400);
  }

  const client = new GoogleGenAI({ apiKey });
  let extracted: Record<string, unknown>;
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents:
        '這是一個咖啡豆商品頁面的網址與內文，請幫我整理成上架用的結構化資料。' +
        '只使用頁面內實際出現的資訊，找不到的欄位請照 schema 說明留空，不要自己編造內容。\n\n' +
        `網址: ${url}\n\n頁面內容:\n${pageText}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
      },
    });
    if (!response.text) throw new Error('empty response text');
    extracted = JSON.parse(response.text);
  } catch (err) {
    console.error('extract-bean: gemini extraction failed', err);
    return json({ error: '解析網頁內容失敗，請稍後再試或改用手動輸入' }, 502);
  }

  return json(extracted);
};

export const config: Config = {
  path: '/api/extract-bean',
};
