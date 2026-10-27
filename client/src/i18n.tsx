import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'zh' | 'en';
const STORAGE_KEY = 'onebox-lang';

// UI chrome only - coffee/bean/special content typed in the admin (names,
// descriptions, tasting notes, roast labels, bag labels) is never translated
// here; it's shown exactly as entered regardless of language.
const DICT: Record<string, { zh: string; en: string }> = {
  'ticker.msg1': { zh: '每週二三新鮮烘焙到貨', en: 'Freshly roasted, delivered Tue & Wed' },
  'ticker.msg2': { zh: '單一產區，誠實標示', en: 'Single origin, honestly labeled' },
  'ticker.msg3': { zh: '手沖吧現場供應中', en: 'Hand-drip bar open now' },
  'ticker.msg4': { zh: '滿 $500 全台免運', en: 'Free shipping over $500' },

  'cover.tapHint': { zh: '點一下箱子，看看今天躲了什麼豆', en: 'Tap the box to see today’s beans' },
  'cover.cta': { zh: '開始點餐', en: 'Start Order' },
  'cover.catAlt': { zh: 'onebox 貓', en: 'onebox cat' },

  'category.drip': { zh: '手沖咖啡', en: 'Drip Coffee' },
  'category.beans': { zh: '買豆子', en: 'Beans' },
  'category.special': { zh: '特調', en: 'Specials' },
  'category.history': { zh: '過往豆單', en: 'Past Lineup' },

  'title.drip.eyebrow': { zh: "TODAY'S DRIP BAR · 本日手沖", en: "TODAY'S DRIP BAR" },
  'title.drip.heading1': { zh: '今天，', en: 'Today,' },
  'title.drip.heading2': { zh: '想喝哪一支？', en: 'which one to brew?' },
  'title.beans.eyebrow': { zh: 'BEANS TO GO · 買豆子回家', en: 'BEANS TO GO' },
  'title.beans.heading1': { zh: 'Coffee', en: 'Coffee' },
  'title.beans.heading2': { zh: '', en: '' },
  'title.special.eyebrow': { zh: "TODAY'S SPECIAL · 本日特調", en: "TODAY'S SPECIAL" },
  'title.special.heading1': { zh: '今天，', en: 'Today,' },
  'title.special.heading2': { zh: '想喝點特別的？', en: 'fancy something special?' },
  'title.history.eyebrow': { zh: 'ARCHIVE · 過往豆單', en: 'ARCHIVE' },
  'title.history.heading1': { zh: '回顧一下，', en: 'A look back' },
  'title.history.heading2': { zh: '我們出過的豆子', en: 'at beans we’ve featured' },

  'filter.roast': { zh: '烘焙度 ROAST', en: 'ROAST' },
  'filter.origin': { zh: '產區 ORIGIN', en: 'ORIGIN' },
  'filter.roaster': { zh: '烘豆商 ROASTER', en: 'ROASTER' },
  'filter.sort': { zh: '排序 SORT', en: 'SORT' },
  'filter.all': { zh: '全部', en: 'All' },
  'filter.roastLight': { zh: '淺', en: 'Light' },
  'filter.roastMid': { zh: '中', en: 'Medium' },
  'filter.roastDark': { zh: '深', en: 'Dark' },
  'filter.button': { zh: '篩選', en: 'Filter' },
  'filter.title': { zh: '篩選 FILTERS', en: 'FILTERS' },
  'filter.results': { zh: '{count} 個結果', en: '{count} Results' },
  'filter.done': { zh: '完成', en: 'Done' },
  'filter.clearAll': { zh: '清除全部', en: 'Clear all' },
  'sort.default': { zh: '預設', en: 'Default' },
  'sort.newest': { zh: '最新上架', en: 'Newest' },
  'sort.priceAsc': { zh: '價格低到高', en: 'Price: Low to High' },
  'sort.priceDesc': { zh: '價格高到低', en: 'Price: High to Low' },

  'common.loading': { zh: '載入中…', en: 'Loading…' },
  'common.qty': { zh: '數量', en: 'Qty' },
  'common.tempHot': { zh: '熱', en: 'Hot' },
  'common.tempIce': { zh: '冰', en: 'Iced' },
  'common.sizeStd': { zh: '標準', en: 'Standard' },
  'common.sizeLarge': { zh: '大杯', en: 'Large' },
  'menu.noDripMatch': { zh: '沒有符合篩選條件的咖啡，試試看調整篩選條件', en: 'No coffee matches your filters — try adjusting them' },
  'menu.noBagOptions': { zh: '尚未設定零售重量', en: 'Weight options coming soon' },
  'menu.bagOptionsCount': { zh: '{count} 種包裝可選', en: '{count} sizes available' },
  'menu.noBeansAtAll': { zh: '目前沒有開放零售的豆子', en: 'No beans available for retail right now' },
  'menu.noBeansMatch': { zh: '沒有符合篩選條件的豆子，試試看調整篩選條件', en: 'No beans match your filters — try adjusting them' },
  'menu.noSpecialsToday': { zh: '今天還沒有特調', en: 'No specials today' },
  'menu.specialBadge': { zh: 'SPECIAL · 特調', en: 'SPECIAL' },
  'stock.soldOut': { zh: '已售完', en: 'Sold Out' },
  'stock.discontinued': { zh: '已下架', en: 'Discontinued' },
  'menu.noHistory': { zh: '目前還沒有過往豆單', en: 'No past beans yet' },
  'menu.historyHint': { zh: '這些豆款目前已下架，僅供回顧，無法下單', en: 'These beans are discontinued — for browsing only, not orderable' },

  'detail.tastingNotes': { zh: 'TASTING NOTES · 風味', en: 'TASTING NOTES' },
  'detail.spec.roaster': { zh: 'ROASTER 烘豆商', en: 'ROASTER' },
  'detail.spec.process': { zh: 'PROCESS 處理法', en: 'PROCESS' },
  'detail.spec.altitude': { zh: 'ALTITUDE 海拔', en: 'ALTITUDE' },
  'detail.spec.varietal': { zh: 'VARIETAL 品種', en: 'VARIETAL' },
  'detail.spec.roast': { zh: 'ROAST 烘焙', en: 'ROAST' },
  'detail.spec.origin': { zh: 'ORIGIN 產區', en: 'ORIGIN' },
  'detail.mode.drip': { zh: '現場手沖', en: 'Brew Here' },
  'detail.mode.beans': { zh: '買豆子回家', en: 'Beans to Go' },
  'detail.temperature': { zh: '溫度', en: 'Temperature' },
  'detail.tempHot': { zh: '熱手沖', en: 'Hot' },
  'detail.tempIce': { zh: '冰手沖', en: 'Iced' },
  'detail.size': { zh: '份量', en: 'Size' },
  'detail.sizeStd': { zh: '標準', en: 'Standard' },
  'detail.sizeLarge': { zh: '大杯 +$20', en: 'Large +$20' },
  'detail.weight': { zh: '重量 WEIGHT', en: 'WEIGHT' },
  'detail.addToCart': { zh: '加入購物車', en: 'Add to Cart' },
  'detail.addedToast': { zh: '已加入 · ', en: 'Added · ' },

  'review.eyebrow': { zh: 'FEEDBACK · 風味回饋', en: 'FEEDBACK' },
  'review.noneYet': { zh: '目前還沒有人評分，當第一個留下回饋的人吧', en: 'No ratings yet — be the first to leave feedback' },
  'review.count': { zh: '{count} 則評分', en: '{count} ratings' },
  'review.flavorMatch': { zh: '喝到這個風味的人', en: 'Tasters who picked this' },
  'review.prompt': { zh: '喝完了嗎？幫這支豆打個分數', en: 'Finished your cup? Rate this bean' },
  'review.flavorPrompt': { zh: '你喝到了哪些風味？（可複選，非必填）', en: 'Which flavors did you taste? (optional, pick any)' },
  'review.submit': { zh: '送出評分', en: 'Submit Rating' },
  'review.submitting': { zh: '送出中…', en: 'Submitting…' },
  'review.thanks': { zh: '謝謝你的回饋！', en: 'Thanks for your feedback!' },
  'review.needRating': { zh: '請先選擇星等', en: 'Please select a rating first' },
  'review.failed': { zh: '送出失敗，請再試一次', en: 'Failed to submit — please try again' },

  'cart.title': { zh: '購物車', en: 'Cart' },
  'cart.pickupMethod': { zh: '取貨方式', en: 'Pickup Method' },
  'cart.pickup': { zh: '門市自取', en: 'Pickup' },
  'cart.delivery': { zh: '外送到家', en: 'Delivery' },
  'cart.locating': { zh: '定位中…', en: 'Locating…' },
  'cart.geoUnsupported': { zh: '這個瀏覽器不支援定位，請改選自取', en: 'This browser doesn’t support location — please choose pickup instead' },
  'cart.geoOutOfRange': { zh: '此位置距離超過 {maxKm} 公里外送範圍，請改選自取', en: 'This location is beyond our {maxKm}km delivery range — please choose pickup instead' },
  'cart.geoQuoteFailed': { zh: '計算運費失敗，請改選自取', en: 'Failed to calculate delivery fee — please choose pickup instead' },
  'cart.geoDenied': { zh: '無法取得你的定位，請允許定位權限，或改選自取', en: 'Couldn’t get your location — please allow location access, or choose pickup instead' },
  'cart.distanceFee': { zh: '距離約 {km} 公里，外送費 ${fee}', en: 'About {km}km away, delivery fee ${fee}' },
  'cart.subtotal': { zh: '小計', en: 'Subtotal' },
  'cart.deliveryFeeLabel': { zh: '外送費', en: 'Delivery Fee' },
  'cart.pickupFree': { zh: '門市自取 · 免費', en: 'Pickup · Free' },
  'cart.total': { zh: '總計', en: 'Total' },
  'cart.nameLabel': { zh: '取餐姓名 / 暱稱', en: 'Name / Nickname' },
  'cart.nameLabelBeans': { zh: '姓名 / 暱稱', en: 'Name / Nickname' },
  'cart.namePlaceholder': { zh: '方便店員叫號時稱呼你', en: 'So we can call your name when it’s ready' },
  'cart.namePlaceholderBeans': { zh: '方便我們核對是你的訂單', en: 'So we can confirm it’s your order' },
  'cart.emailLabel': { zh: 'Email', en: 'Email' },
  'cart.emailPlaceholder': { zh: '方便我們聯絡你', en: 'So we can reach you' },
  'cart.needEmail': { zh: '請輸入有效的 Email', en: 'Please enter a valid email address' },
  'cart.noteBrewedPickup': { zh: '現點現沖，預計 8–12 分鐘 完成，我們會在吧台叫號。', en: 'Freshly brewed to order, ready in about 8–12 minutes — we’ll call your name at the counter.' },
  'cart.noteBrewedDelivery': { zh: '現點現沖，預計 8–12 分鐘 沖煮完成後為你送達，請保持手機暢通。', en: 'Freshly brewed to order, delivered about 8–12 minutes after brewing — please keep your phone handy.' },
  'cart.noteBeansPickup': { zh: '豆子已包裝好，到店直接取貨即可。', en: 'Your beans are packed and ready — just pick them up in store.' },
  'cart.noteBeansDelivery': { zh: '豆子已包裝好，會盡快為你送達。', en: 'Your beans are packed and will be delivered as soon as possible.' },
  'cart.placing': { zh: '送出中…', en: 'Placing order…' },
  'cart.placeOrder': { zh: '送出訂單', en: 'Place Order' },
  'cart.needName': { zh: '請輸入取餐姓名 / 暱稱', en: 'Please enter your name / nickname' },
  'cart.placeFailed': { zh: '送出失敗，請再試一次', en: 'Failed to place order — please try again' },
  'cart.empty.title': { zh: '箱子還空空的', en: 'The box is empty' },
  'cart.empty.subtitle': { zh: '挑一支今天的手沖吧', en: 'Pick today’s brew' },
  'cart.empty.cta': { zh: '去看菜單', en: 'View Menu' },

  'success.accepted': { zh: '已接單', en: 'Order Received' },
  'success.delivery': { zh: '外送', en: 'Delivery' },
  'success.pickup': { zh: '門市自取', en: 'Pickup' },
  'success.total': { zh: '總計 $', en: 'Total $' },
  'success.brewing': { zh: '為你手沖中，預計 8–12 分鐘 ☕', en: 'Brewing your order, ready in about 8–12 minutes ☕' },
  'success.orderNumber': { zh: '訂單編號 #{id}', en: 'Order #{id}' },
  'success.lookupLink': { zh: '之後想查詢這筆訂單 →', en: 'Check this order later →' },

  'lookup.entryLink': { zh: '查詢訂單', en: 'Track Order' },
  'lookup.eyebrow': { zh: 'TRACK ORDER · 查詢訂單', en: 'TRACK ORDER' },
  'lookup.heading': { zh: '查詢我的訂單', en: 'Track My Order' },
  'lookup.idLabel': { zh: '訂單編號', en: 'Order Number' },
  'lookup.idPlaceholder': { zh: '例如 123', en: 'e.g. 123' },
  'lookup.emailLabel': { zh: '下單時填寫的 Email', en: 'Email used at checkout' },
  'lookup.submit': { zh: '查詢', en: 'Track' },
  'lookup.searching': { zh: '查詢中…', en: 'Searching…' },
  'lookup.needBoth': { zh: '請輸入訂單編號與 Email', en: 'Please enter both order number and email' },
  'lookup.notFound': { zh: '找不到這筆訂單，請確認訂單編號與 Email 是否正確', en: 'Order not found — please check the order number and email' },
  'lookup.fulfilledPickup': { zh: '已取貨', en: 'Picked Up' },
  'lookup.fulfilledDelivery': { zh: '已送達', en: 'Delivered' },
  'lookup.pending': { zh: '準備中', en: 'In Progress' },
  'leaderboard.entryLink': { zh: '排行榜', en: 'Leaderboard' },
  'leaderboard.bannerTitle': { zh: '購買力排行榜', en: 'Spending Leaderboard' },
  'leaderboard.bannerTeaser': { zh: '目前第一名 {name} 消費 ${amount}，你能超越嗎？', en: '{name} is in the lead with ${amount} — can you beat it?' },
  'leaderboard.bannerTeaserEmpty': { zh: '還沒有人上榜，第一筆訂單就能拿下第一名！', en: 'No one on the board yet — your first order could take #1!' },
  'leaderboard.eyebrow': { zh: 'LEADERBOARD · 購買力排行榜', en: 'LEADERBOARD' },
  'leaderboard.heading': { zh: '購買力排行榜', en: 'Spending Leaderboard' },
  'leaderboard.hint': { zh: '依歷史累計消費總額排序，顯示前 20 名（姓名部分字元已隱藏）', en: 'Ranked by all-time total spend, top 20 (names are partially masked)' },
  'leaderboard.orderCount': { zh: '{count} 筆訂單', en: '{count} orders' },
  'leaderboard.empty': { zh: '還沒有任何訂單紀錄', en: 'No orders yet' },
  'leaderboard.podiumRank': { zh: '第 {rank} 名', en: 'Rank {rank}' },
  'memberLevel.entryLink': { zh: '我的等級', en: 'My Level' },
  'memberLevel.eyebrow': { zh: 'MEMBER LEVEL · 會員等級', en: 'MEMBER LEVEL' },
  'memberLevel.heading': { zh: '查詢我的會員等級', en: 'Check My Member Level' },
  'memberLevel.hint': { zh: '每累計消費 $500 的豆子升一等，沒有上限', en: 'Every $500 spent on beans levels you up — no cap' },
  'memberLevel.emailLabel': { zh: '下單時填寫的 Email', en: 'Email used at checkout' },
  'memberLevel.submit': { zh: '查詢', en: 'Check' },
  'memberLevel.searching': { zh: '查詢中…', en: 'Checking…' },
  'memberLevel.needEmail': { zh: '請輸入 Email', en: 'Please enter your email' },
  'memberLevel.failed': { zh: '查詢失敗，請稍後再試', en: 'Something went wrong — please try again' },
  'memberLevel.currentLevel': { zh: '目前等級', en: 'Current Level' },
  'memberLevel.beansSpent': { zh: '豆子累計消費 ${amount}', en: '${amount} spent on beans' },
  'memberLevel.toNext': { zh: '距離 Lv.{level} 還差 ${amount}', en: '${amount} to Lv.{level}' },
  'memberLevel.claimFailed': { zh: '選擇失敗，請稍後再試', en: 'Something went wrong — please try again' },
  'memberLevel.levelUpEyebrow': { zh: 'LEVEL UP · 升級了', en: 'LEVEL UP' },
  'memberLevel.levelUpHeading': { zh: '升到 Lv.{level} 了！選一個技能', en: 'You reached Lv.{level}! Pick a skill' },
  'memberLevel.rewardHistory': { zh: '已選技能', en: 'Skills Chosen' },
  'memberLevel.redeemed': { zh: '已兌換', en: 'Redeemed' },
  'memberLevel.pending': { zh: '待兌換', en: 'Pending' },

  'account.login': { zh: '登入', en: 'Log In' },
  'account.loginHeading': { zh: '輸入下單時的 Email', en: 'Enter the email you order with' },
  'account.loginSubmit': { zh: '登入', en: 'Log In' },
  'account.loginNeedEmail': { zh: '請輸入 Email', en: 'Please enter your email' },
  'account.logout': { zh: '登出', en: 'Log Out' },
  'account.rewardAvailable': { zh: '有技能可以選擇', en: 'A reward is ready to pick' },

  'a11y.cartEmpty': { zh: '購物車', en: 'Cart' },
  'a11y.cartCount': { zh: '購物車，{count} 件商品', en: 'Cart, {count} items' },
  'a11y.back': { zh: '返回', en: 'Back' },
  'a11y.langToggle': { zh: '切換為英文', en: 'Switch to Chinese' },
};

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template);
}

interface LangContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo<LangContextValue>(() => ({
    lang,
    toggleLang: () => setLang(l => (l === 'zh' ? 'en' : 'zh')),
    t: (key, vars) => {
      const entry = DICT[key];
      if (!entry) return key;
      return format(entry[lang], vars);
    },
  }), [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
