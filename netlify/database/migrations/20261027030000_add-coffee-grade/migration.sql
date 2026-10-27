-- Rarity classification (義式豆/日常豆/稀有豆/競賽等級豆) - admin picks one
-- from a fixed set (see lib/coffeeGrade.ts), shown as a menu filter, a
-- small badge on the product card/detail page, and in the new-bean launch
-- email. NULL for every existing coffee until the admin sets one by hand.
ALTER TABLE coffees ADD COLUMN grade TEXT NULL;
