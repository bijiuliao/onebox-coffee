import type { Config } from '@netlify/functions';
import { GoogleGenAI, Type } from '@google/genai';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_CHARS = 500_000;
const MAX_TEXT_CHARS_FOR_PROMPT = 20_000;

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
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; oneboxCoffeeBot/1.0; +https://onebox.coffee)' },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return json({ error: `無法讀取這個網址（伺服器回應 ${res.status}）` }, 400);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return json({ error: '這個網址看起來不是網頁內容' }, 400);
    }
    html = (await res.text()).slice(0, MAX_HTML_CHARS);
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return json({ error: timedOut ? '讀取網頁逾時，請稍後再試' : '無法讀取這個網址' }, 400);
  }

  const pageText = htmlToText(html).slice(0, MAX_TEXT_CHARS_FOR_PROMPT);
  if (!pageText) return json({ error: '這個網頁沒有可讀取的文字內容' }, 400);

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
