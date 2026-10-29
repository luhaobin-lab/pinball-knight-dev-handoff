# Merchant and recovery source slice

Source roots: copied reference/dump/blueprints-pseudo/CatapultHero/BP.

- Actor/蓝图_动作游戏模式 L2424 spawns a real 蓝图_商店 at roomcentre+(100,380,0), with hero(-120,-156,0) and
  junction(-160,390,-1). 清理房间 L2832 calls 销毁目标和子物体(shop), including merchant/shelves. An earlier port
  destroyed only root; the real seven-floor tutorial exposed the stale F5merchant survivingF6/F7. Now source helper
  and explicit tree-cleanup regression prevent this.
- 环境/商店/蓝图_商店 L15/1073: purchase allowance1, shelf count equals actual reward parameter length. Merchant
  data row商人, atshop+(64,40,64); shelves at shop+(0,idx*int(-720/count)+(4-count)*-69-276,0). No assumed3shelves.
- 蓝图_货架 L799: exact prop row from parameter text, levelindex+1, atshelf+(56,0,rowheight), activate/update, add
  environment interaction, set rawprice to parameter, attach toshop andmapproduct->shelf. UIprice source widget
  RelativeLocation(-20.33075,16.081781,5.5). The renderer projects that exact anchor with procedural pixel digits.
- Actor/蓝图_主角色控制器 交互到商品: zero allowance/dead do nothing; unaffordable shows source notice; ownskill0
  must pass BEFORE payment; reads currentrawprice again then pays/sound, infiniteproduct skips detach/decrement.
  交互到商人 onlyphase12 marksmissioncomplete andcallsnewround. Legal does not advertise its inertpostphaseclick;
  tutorial play found that otherwise it starved the pending source endfloor callback in event-jump simulation.
- Shelf L3077/L155 clearsprice, calls intentionalmentalno-op, sound, decrements allowance; onlyallowance0 AND no
  visiblemultiChoice AND closedlootbox completesmission/newround. Otherwise actualrewardpage finish owns continuation.
- 环境/装饰品/地铺 L1157 marksconsumedonce, sourceinputshield/loading; .75close loading, .5remove harmful effects,
  heal100% andstamina100%, mentalno-op, finishmission/newround. Existing proceduralcampfire represents this sourceprop.

Real tests: source tutorial onebronzehammer4coins rejects unaffordable/noeligibleitem withoutcharge, then actual old
swordquality1→2 andonepurchase, exactordinary获取锻造2shelves price12/0, actualview/legalmerchant/product, postphase
inertinput, complete recursivecleanup, and realrest.75+.5timing. Initial test assumptions3shelves andnohammerupgrade
were wrong; corrected from actualrows/previouslyreviewedhammer source, never productionnumbers.

Browser tools/parity/shop-browser.mjs labels its explicit source boundary: actual ordinaryboot/firstroom, source
tutorialshop/item/4coin fixture BEFORE interaction, realmouse clicks hammer, gold4→0/item1→2/pricecleared. Exact
clean763112f report and twoframes in studio/shots/parity-shop-763112f, errors0/allclean, full2826pass6todo.
Independent completeprologue natural acquisition/purchase comes from progress tutorial lane. Ordinary recovery/shop
tile admission and broadernaturalshop proof are pending. Fine reference bakedbackground/shelf geometry/materials and
audio are not claimed1:1; approved proceduralshop/anvil/altar/jar are reused, exactpriceposition retained.
