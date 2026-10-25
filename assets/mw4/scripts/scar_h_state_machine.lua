-- 脚本的位置是 "{命名空间}:{路径}"，那么 require 的格式为 "{命名空间}_{路径}"
-- 注意！require 取得的内容不应该被修改，应仅调用
local default = require("mw4_default_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states
local static_track_top = default.static_track_top

local inspect_state = setmetatable({}, {__index = main_track_states.inspect})
local idle_state = setmetatable({}, {__index = main_track_states.idle})


-- 相当于 obj.value++
local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

local FIRE_MODE_TRACK = increment(static_track_top)
local SWITCH_MODE_TRACK = increment(static_track_top)

-- 检查当前是否还有弹药
local function isNoAmmo(context)
    -- 这里同时检查了枪管和弹匣
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

-- 判断当前弹匣是否为弹鼓：3 级扩容（mag_extended_3 / mw4:drum_mag）即视为弹鼓
local function isDrumMag(context)
    if context:getMagExtentLevel() == 3 then
        return true
    end
    if context.getAttachment == nil then
        return false
    end
    return context:getAttachment("extended_mag") == "mw4:drum_mag"
end

local function runReloadAnimation(context)
    -- 此处获取的轨道是位于主轨道行上的主轨道
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    local isDrum = isDrumMag(context)
    -- 根据当前整枪内是否还有弹药决定是播放战术换弹还是空枪换弹
    if (isNoAmmo(context)) then
        if (isDrum) then
            -- 弹鼓空仓换弹
            context:runAnimation("reload_drum_empty", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 2) then
            -- 2 级扩容空仓换弹
            context:runAnimation("reload_empty_xmag_2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            -- 1 级扩容空仓换弹
            context:runAnimation("reload_empty_xmag_1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("reload_empty", track, false, PLAY_ONCE_STOP, 0.2)
        end
    else
        if (isDrum) then
            -- 弹鼓战术换弹
            context:runAnimation("reload_drum", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 2) then
            -- 2 级扩容战术换弹
            context:runAnimation("reload_tactical_xmag_2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            -- 1 级扩容战术换弹
            context:runAnimation("reload_tactical_xmag_1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("reload_tactical", track, false, PLAY_ONCE_STOP, 0.2)
        end
    end
end

local function runInspectAnimation(context)
    -- 此处获取的轨道是位于主轨道行上的主轨道
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    local isDrum = isDrumMag(context)
    -- 根据当前整枪内是否还有弹药决定是播放普通检视还是空枪检视
    if (isNoAmmo(context)) then
        if (isDrum) then
            -- 弹鼓空仓检视
            context:runAnimation("inspect_drum_empty", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 2) then
            -- 2 级扩容空仓检视
            context:runAnimation("inspect_empty_xmag_2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            -- 1 级扩容空仓检视
            context:runAnimation("inspect_empty_xmag_1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
        end
    else
        if (isDrum) then
            -- 弹鼓检视
            context:runAnimation("inspect_drum", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext > 0) then
            context:runAnimation("inspect_xmag", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
        end
    end
end

function idle_state.transition(this, context, input)
    if (input == INPUT_RELOAD) then
        runReloadAnimation(context)
        return this.main_track_states.idle
    end
    if (input == INPUT_PUT_AWAY) then
        local put_away_time = context:getPutAwayTime()
        -- 此处获取的轨道是位于主轨道行上的主轨道
        local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
        -- 停下切换模式动画
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
        -- 播放 put_away 动画,并且将其过渡时长设为从上下文里传入的 put_away_time * 0.75
                -- 空仓时改用 put_away_empty，收枪过程中也保持空仓姿态
        local putAwayAnimation = "put_away"
        if ((not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)) then
            putAwayAnimation = "put_away_empty"
        end
        context:runAnimation(putAwayAnimation, track, false, PLAY_ONCE_HOLD, put_away_time * 0.75)
        -- 设定动画进度为最后一帧
        context:setAnimationProgress(track, 1, true)
        -- 将动画进度向前拨动 {put_away_time}
        context:adjustAnimationProgress(track, -put_away_time, false)
        return this.main_track_states.final
    end
    if (input == INPUT_INSPECT) then
        runInspectAnimation(context)
        return inspect_state
    end
    return main_track_states.idle.transition(this, context, input)
end

-- 此处为开火模式轨道的状态,专门为快慢机动画服务,兼容其他动作,可按需求添加三种射击模式(semi、burst、auto)
local fire_mode_state = {
    -- 半自动状态
    semi = {},
    -- 全自动状态
    auto = {},
    -- 掏枪状态
    draw = {}
}
-- 这一块专门用来检测枪械在掏枪(播放draw)时枪械处于什么射击模式,并切换到对应模式的idle
function fire_mode_state.draw.update(this, context)
    context:trigger(this.INPUT_MODE_DRAW)
end

function fire_mode_state.draw.transition(this, context,input)
    if (input == this.INPUT_MODE_DRAW) then
        if (context:getFireMode() == SEMI) then
            context:runAnimation("static_semi", context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK), true, PLAY_ONCE_HOLD, 0)
            return fire_mode_state.semi
        elseif (context:getFireMode() == AUTO) then
            context:runAnimation("static_auto", context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK), true, PLAY_ONCE_HOLD, 0)
            return fire_mode_state.auto
        end
    end
end
-- 注意!后面关于每个开火模式对应状态之间的切换,需要按照data里填写的顺序进行转换
function fire_mode_state.semi.update(this, context)
    -- 当进入特定开火模式的状态时,挂起动画
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
    end
    -- 为特定开火模式定义输入状态
    if (context:getFireMode() == AUTO) then
        -- 模式已切换：姿态立即跟上（拨杆动画仍由 SWITCH_MODE_TRACK 带锁单独播放）
        context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0)
        -- 检视/换弹/掏枪等主轨道动画还在播时不插播拨杆，等主轨道空下来再补播；
        -- 开镜不参与这个判断（开镜时照常立刻播拨杆，见下方注释）
        if (context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))) then
            context:trigger(this.INPUT_MODE_AUTO)
        end
    end
    -- 开镜状态照常播拨杆（官方行为）：不要在开镜时停掉它，
    -- 否则玩家会以为「开镜时切不了快慢机」
end
-- 当检测到对应输入状态时播放对应快慢机动画
function fire_mode_state.semi.transition(this, context,input)
    if(input == this.INPUT_MODE_AUTO)then
        local switchTrack = context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)
        -- 上一次拨杆动画（含音效）还没播完就忽略这次切换，避免动画/音效叠加
        if (not context:isStopped(switchTrack)) then
            return nil
        end
        context:runAnimation("switch_auto", switchTrack, false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.auto
    end
-- 检测到开火输入,换弹输入,检视输入时后停止播放动画,不然会出现两个动画在不同的轨道播放,从而出现动画衔接问题
    if(input == INPUT_SHOOT)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_RELOAD)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_INSPECT)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end
-- 和上面同理
function fire_mode_state.auto.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0)
    end
    if (context:getFireMode() == SEMI) then
        -- 模式已切换：姿态立即跟上（拨杆动画仍由 SWITCH_MODE_TRACK 带锁单独播放）
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
        -- 检视/换弹/掏枪等主轨道动画还在播时不插播拨杆，等主轨道空下来再补播；
        -- 开镜不参与这个判断（开镜时照常立刻播拨杆，见下方注释）
        if (context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))) then
            context:trigger(this.INPUT_MODE_SEMI)
        end
    end
    -- 开镜状态照常播拨杆（官方行为）：不要在开镜时停掉它，
    -- 否则玩家会以为「开镜时切不了快慢机」
end

function fire_mode_state.auto.transition(this, context,input)
    if(input == this.INPUT_MODE_SEMI)then
        local switchTrack = context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)
        -- 上一次拨杆动画（含音效）还没播完就忽略这次切换，避免动画/音效叠加
        if (not context:isStopped(switchTrack)) then
            return nil
        end
        context:runAnimation("switch_semi", switchTrack, false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.semi
    end
    if(input == INPUT_SHOOT)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_RELOAD)then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if(input == INPUT_INSPECT )then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end

-- 当检测到开火模式切换输入时应该直接停止动画并返回闲置态
function inspect_state.transition(this, context, input)
    -- 快慢机（切换开火模式）立刻打断检视动画并回到闲置态
    if (input == INPUT_FIRE_SELECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))
        return this.main_track_states.idle
    end
    return main_track_states.inspect.transition(this, context, input)
end



-- 用元表的方式继承默认状态机的属性
local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state,
        inspect = inspect_state
    }, {__index = main_track_states}),
    ADS_states = setmetatable({}, {__index = default.ADS_states}),
    FIRE_MODE_TRACK = FIRE_MODE_TRACK,
    SWITCH_MODE_TRACK = SWITCH_MODE_TRACK,
    INPUT_MODE_SEMI = "input_mode_semi",
    INPUT_MODE_AUTO = "input_mode_auto",
    INPUT_MODE_DRAW = "input_mode_draw",
    fire_mode_state = fire_mode_state
}, {__index = default})
function M:initialize(context)
    default.initialize(self, context)
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
        self.fire_mode_state.draw
    }
end
-- 导出状态机
return M
