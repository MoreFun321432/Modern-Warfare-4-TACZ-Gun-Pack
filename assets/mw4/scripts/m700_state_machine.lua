-- 脚本的位置是 "{命名空间}:{路径}"，那么 require 的格式为 "{命名空间}_{路径}"
-- 注意！require 取得的内容不应该被修改，应仅调用
-- ============================================================================
-- M700 专属状态机（mw4:m700_state_machine）
-- 路径: assets/mw4/scripts/m700_state_machine.lua
--
-- 为什么需要它：
--   M700 是「手动栓动 + 可装扩容弹匣」的狙击枪，动画里同时存在
--   普通档（弹匣 5 发）与扩容档（弹匣 6/8/10 发）两套换弹/检视动画：
--     reload_tactical / reload_empty            <- 普通档
--     reload_tactical_xmag / reload_empty_xmag  <- 扩容档
--     inspect / inspect_empty                   <- 普通档
--     inspect_xmag / inspect_empty_xmag         <- 扩容档
--   而 TACZ 自带的 tacz:manual_action_state_machine（及其基座
--   tacz_default_state_machine）**完全没有扩容等级路由**：它只按
--   「空仓 / 非空仓」二选一播 reload_empty / reload_tactical。
--   => 装了扩容弹匣后仍在播普通档动画（弹匣模型是 5 发那只），
--      扩容档专属音效（..._xmag_*.ogg）也永远不会响。
--   本状态机按 context:getMagExtentLevel() 把四类动画都路由到正确档位。
--
-- 定制内容（相对 tacz:manual_action_state_machine）：
--   1. 扩容路由：换弹与检视各分「空仓/非空仓 × 普通/扩容」四条路径；
--   2. 抛壳时机分档：普通档 reload_empty_shell_ejecting_time、
--      扩容档 reload_empty_xmag_shell_ejecting_time（均由 display 传入）；
--   3. 换弹期间屏蔽拉栓（reloading 标志），避免拉栓打断换弹动画；
--   4. 拉栓收尾窗口：bolt 播完保持末帧后用一段过渡平滑切到 static_idle，
--      避免 PLAY_ONCE_HOLD 轨道自然释放造成回弹跳动；
--   5. 换弹抛壳待办随切枪/丢枪复位，避免残留到下一把枪。
-- ============================================================================

local default = require("mw4_manual_action_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local BLENDING_TRACK_LINE = default.BLENDING_TRACK_LINE
local SLIDE_TRACK = default.SLIDE_TRACK
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states
local static_track_top = default.static_track_top

-- 覆盖 idle 与 inspect 两个状态（inspect 要按档位选动画）
local idle_state = setmetatable({}, {__index = main_track_states.idle})
local inspect_state = setmetatable({}, {__index = main_track_states.inspect})

-- 相当于 obj.value++
local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

-- 检查当前是否还有弹药（弹匣与膛内都空才算空仓）
local function isNoAmmo(context)
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

-- 当前扩容等级：0 = 未装扩容，1/2/3 = 三档扩容。
-- 本枪四档动画只分「普通档」与「扩容档」两种，故 1/2/3 归为同一档。
local function magLevel(context)
    local ext = context:getMagExtentLevel()
    if (ext == nil) then
        return 0
    end
    return ext
end

local function isExtMag(context)
    return magLevel(context) >= 1
end

-- 空仓换弹抛壳时刻（毫秒）。两档用的是不同动画，弹壳飞出时刻也不同，
-- 两个时刻都由 display 的 state_machine_param 传入。
local function get_ejection_time(context)
    local params = context:getStateMachineParams()
    local ejection_time = nil
    if (isExtMag(context) and params.reload_empty_xmag_shell_ejecting_time) then
        ejection_time = params.reload_empty_xmag_shell_ejecting_time
    elseif (params.reload_empty_shell_ejecting_time) then
        ejection_time = params.reload_empty_shell_ejecting_time
    end
    if (ejection_time) then
        return ejection_time * 1000
    else
        return 0
    end
end

-- 按「是否有弹药 + 扩容等级」挑换弹片段名
local function pickReloadClip(context)
    if (isNoAmmo(context)) then
        if (isExtMag(context)) then
            return "reload_empty_xmag"
        end
        return "reload_empty"
    else
        if (isExtMag(context)) then
            return "reload_tactical_xmag"
        end
        return "reload_tactical"
    end
end

-- 按「是否有弹药 + 扩容等级」挑检视片段名
local function pickInspectClip(context)
    if (isNoAmmo(context)) then
        if (isExtMag(context)) then
            return "inspect_empty_xmag"
        end
        return "inspect_empty"
    else
        if (isExtMag(context)) then
            return "inspect_xmag"
        end
        return "inspect"
    end
end

local function runReloadAnimation(context)
    -- 此处获取的轨道是位于主轨道行上的主轨道
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    context:runAnimation(pickReloadClip(context), track, false, PLAY_ONCE_STOP, 0.2)
end

local function runInspectAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    context:runAnimation(pickInspectClip(context), track, false, PLAY_ONCE_STOP, 0.2)
end

-- 换弹动画进行中标志：换弹期间屏蔽自动/手动拉栓，避免拉栓打断换弹
local reloading = false
-- 拉栓收尾窗口（毫秒）：bolt 动画片长 1.47s，播完保持末帧后在此窗口内平滑收尾
local BOLT_SETTLE_FROM = 1440
local BOLT_SETTLE_TO = 1620

function idle_state.transition(this, context, input)
    -- 切枪动画播放期间，除拉栓外的任何新动作都会打断掏枪，清掉标记
    if (this.drawing and input ~= INPUT_BOLT) then
        this.drawing = false
    end
    if (input == INPUT_RELOAD) then
        reloading = true
        -- 取消拉栓收尾待办，避免收尾逻辑顶掉刚启动的换弹动画
        if (this.main_track_states.bolt ~= nil) then
            this.main_track_states.bolt.timestamp = -1
        end
        -- 空仓时记录抛壳时刻（扩容档用另一个时刻）
        if (isNoAmmo(context)) then
            idle_state.timestamp = context:getCurrentTimestamp()
            idle_state.ejection_time = get_ejection_time(context)
        end
        runReloadAnimation(context)
        return this.main_track_states.idle
    end
    if (input == INPUT_PUT_AWAY) then
        reloading = false
        if (this.main_track_states.bolt ~= nil) then
            this.main_track_states.bolt.timestamp = -1
        end
        local put_away_time = context:getPutAwayTime()
        local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
        -- 停止快慢机切换动画轨道（本枪无快慢机片段，该轨道不会被写入）
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
        -- 空仓时改用 put_away_empty，收枪过程中也保持空仓姿态
        local putAwayAnimation = "put_away"
        if (isNoAmmo(context)) then
            putAwayAnimation = "put_away_empty"
        end
        context:runAnimation(putAwayAnimation, track, false, PLAY_ONCE_HOLD, put_away_time * 0.75)
        -- 设定动画进度为最后一帧
        context:setAnimationProgress(track, 1, true)
        -- 将动画进度向前拨动 {put_away_time}
        context:adjustAnimationProgress(track, -put_away_time, false)
        this.main_track_states.final.isfinal = 1
        -- 丢枪后转到最终态
        return this.main_track_states.final
    end
    if (input == INPUT_INSPECT and context:getAimingProgress() < 1) then
        runInspectAnimation(context)
        return inspect_state
    end
    if (input == INPUT_BOLT) then
        -- 换弹或掏枪动画播放中忽略自动/手动拉栓
        if (reloading or this.drawing) then
            return this.main_track_states.idle
        end
    end
    return main_track_states.idle.transition(this, context, input)
end

function idle_state.update(this, context)
    -- 切枪动画播放完后清除标记
    if (this.drawing and context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))) then
        this.drawing = false
    end
    -- 换弹动画播放完后清除换弹标志
    if (reloading and context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))) then
        reloading = false
    end
    -- 空仓换弹到点抛壳（此时动画里弹壳骨骼正好被隐藏，视觉与逻辑对齐）
    if (idle_state.timestamp ~= nil and idle_state.timestamp ~= -1) then
        if (context:getCurrentTimestamp() - idle_state.timestamp > idle_state.ejection_time) then
            context:popShellFrom(0)
            idle_state.timestamp = -1
        end
    end
    -- 拉栓收尾：bolt 动画播完并保持末帧后，用一段过渡平滑切到 static_idle
    -- 并让主轨道停住，避免 PLAY_ONCE_HOLD 轨道自然释放造成回弹跳动
    local bolt = this.main_track_states.bolt
    if (bolt ~= nil and bolt.timestamp ~= nil and bolt.timestamp ~= -1) then
        local elapsed = context:getCurrentTimestamp() - bolt.timestamp
        -- 仅在拉栓刚播完的一小段窗口内做收尾，避免误伤后续动画
        if (elapsed > BOLT_SETTLE_FROM and elapsed < BOLT_SETTLE_TO) then
            local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
            if (not context:isStopped(track)) then
                context:runAnimation("static_idle", track, false, PLAY_ONCE_STOP, 0.25)
                bolt.timestamp = -1
            end
        end
    end
end

-- 检视态：沿用基座的准星隐藏与打断逻辑（开镜/开火/换弹都会打断检视）
function inspect_state.transition(this, context, input)
    if (input == INPUT_RELOAD) then
        return this.main_track_states.idle.transition(this, context, input)
    end
    return main_track_states.inspect.transition(this, context, input)
end

-- 用元表的方式继承默认状态机的属性
local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state,
        inspect = inspect_state
    }, {__index = main_track_states}),
    FIRE_MODE_TRACK = FIRE_MODE_TRACK,
    SWITCH_MODE_TRACK = SWITCH_MODE_TRACK,
    INPUT_MODE_SEMI = "input_mode_semi",
    INPUT_MODE_BURST = "input_mode_burst",
    INPUT_MODE_AUTO = "input_mode_auto",
    INPUT_MODE_DRAW = "input_mode_draw",
}, {__index = default})

function M:initialize(context)
    default.initialize(self, context)
    -- 清掉可能残留的换弹抛壳待办（换弹途中切枪被打断时最容易留下）
    idle_state.timestamp = -1
    reloading = false
end

-- 继承默认状态机需要重新初始化状态
function M:states()
    return {
        self.base_track_state,
        self.bolt_caught_states.normal,
        self.main_track_states.start,
        self.gun_kick_state,
        self.movement_track_states.idle,
        self.ADS_states.normal,
        self.slide_states.normal,
    }
end

-- 导出状态机
return M
