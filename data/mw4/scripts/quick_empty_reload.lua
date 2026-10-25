local M = {}

-- ===== empty-reload-unlock hook (auto-generated) =====
-- 打空弹匣的那一发：把开火冷却直接抹掉，使「空仓 -> 按 R」当帧即可换弹。
-- 注意：定义了 M.shoot 就会**替换**官方默认开火逻辑，所以必须原样调用 shootOnce。
function M.shoot(api)
    api:shootOnce(api:isShootingNeedConsumeAmmo())
    if (api:getAmmoCountInMagazine() <= 0 and not api:hasAmmoInBarrel()) then
        api:adjustShootInterval(-5000)
    end
end
-- ===== end empty-reload-unlock hook =====

return M
