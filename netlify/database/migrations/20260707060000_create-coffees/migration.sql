CREATE TABLE coffees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin_en TEXT NOT NULL,
  roast TEXT NOT NULL,
  level INTEGER NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]',
  price INTEGER NOT NULL,
  color TEXT NOT NULL,
  score INTEGER NOT NULL,
  process TEXT NOT NULL DEFAULT '',
  altitude TEXT NOT NULL DEFAULT '',
  varietal TEXT NOT NULL DEFAULT '',
  harvest TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  roaster TEXT NOT NULL DEFAULT '',
  hot_enabled BOOLEAN NOT NULL DEFAULT true,
  ice_enabled BOOLEAN NOT NULL DEFAULT true,
  std_enabled BOOLEAN NOT NULL DEFAULT true,
  large_enabled BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO coffees (id, name, origin_en, roast, level, notes, price, color, score, process, altitude, varietal, harvest, description, roaster, hot_enabled, ice_enabled, std_enabled, large_enabled, active, sort_order) VALUES
('yirga', 'Yirgacheffe', 'ETHIOPIA', '淺焙', 2, '["茉莉花","佛手柑","紅茶感"]', 150, '#e8623d', 92, '水洗 Washed', '1,900–2,100m', '原生種 Heirloom', '11–1 月', '明亮的花香與佛手柑，尾韻像一杯清透的紅茶，是入門單品豆的第一口驚喜。', 'onebox roastery', true, true, true, true, true, 0),
('kenya', 'Nyeri AA', 'KENYA', '淺中焙', 3, '["黑醋栗","番茄","明亮酸"]', 170, '#c8342b', 91, '水洗 Washed', '1,700–1,900m', 'SL28 · SL34', '10–12 月', '濃郁的莓果與番茄般的酸甜，結構飽滿、層次分明，喝得到肯亞的個性。', 'onebox roastery', true, true, true, true, true, 1),
('colombia', 'Huila', 'COLOMBIA', '中焙', 3, '["焦糖","杏仁","柑橘"]', 140, '#c98a2e', 89, '水洗 Washed', '1,600–1,800m', 'Caturra · Castillo', '4–6 月', '圓潤的焦糖甜感，杏仁與柑橘平衡，是最耐喝、最安全的日常選擇。', 'onebox roastery', true, true, true, false, true, 2),
('guate', 'Antigua', 'GUATEMALA', '中深焙', 4, '["黑巧克力","黑糖","醇厚"]', 160, '#8f4a30', 90, '水洗 Washed', '1,500–1,700m', 'Bourbon', '1–3 月', '厚實的黑巧克力與黑糖，body 飽滿、餘韻悠長，微涼天氣裡最舒服的一杯。', 'onebox roastery', true, false, true, true, true, 3),
('brazil', 'Cerrado', 'BRAZIL', '深焙', 5, '["可可","榛果","奶油"]', 130, '#6b4a30', 87, '半日曬 Pulped', '1,000–1,200m', 'Mundo Novo', '5–8 月', '低酸醇厚，可可與榛果的溫暖甜感，加奶也好喝，適合每天來一杯。', 'onebox roastery', true, true, true, true, false, 4),
('natural', 'Guji Natural', 'ETHIOPIA', '淺焙', 2, '["藍莓","發酵感","紅酒"]', 160, '#5a4a9e', 93, '日曬 Natural', '2,000–2,200m', '原生種 Heirloom', '11–1 月', '狂野的藍莓與發酵果香，像一杯輕盈的紅酒，給想被驚豔的你。', 'onebox roastery', false, true, true, true, true, 5);
