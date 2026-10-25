-- 脚本的位置是 "{命名空间}:{路径}"，那么 require 的格式为 "{命名空间}_{路径}"
-- 注意！require 取得的内容不应该被修改，应仅调用
local default = require("mw4_manual_action_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local BLENDING_TRACK_LINE = default.BLENDING_TRACK_LINE
local SLIDE_TRACK = default.SLIDE_TRACK
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

-- 检查当前是否还有弹药
local function isNoAmmo(context)
    -- 这里同时检查了枪管和弹匣
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

local function get_ejection_time(context)
    -- 空仓换弹抛壳时刻：扩容档用的是另一段动画，弹壳飞出更晚（见 display 的 state_machine_param）
    local params = context:getStateMachineParams()
    local ext = context:getMagExtentLevel()
    local ejection_time = nil
    if (ext >= 1 and params.reload_empty_xmag_shell_ejecting_time) then
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

local function runReloadAnimation(context)
    -- 此处获取的轨道是位于主轨道行上的主轨道
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    -- 根据当前整枪内是否还有弹药决定是播放战术换弹还是空枪换弹
    -- 扩容档（1/2/3 级）统一播 xmag 片段：本枪只有一套 xmag 动画（弹匣 6/7/8 发）
    if (isNoAmmo(context)) then
        if (ext >= 1) then
            context:runAnimation("reload_empty_xmag", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("reload_empty", track, false, PLAY_ONCE_STOP, 0.2)
        end
    else
        if (ext >= 1) then
            context:runAnimation("reload_tactical_xmag", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("reload_tactical", track, false, PLAY_ONCE_STOP, 0.2)
        end
    end
end

local function runInspectAnimation(context)
    -- 此处获取的轨道是位于主轨道行上的主轨道
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    -- 根据当前整枪内是否还有弹药决定是播放普通检视还是空枪检视
    if (isNoAmmo(context)) then
        context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
    else
        context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
    end
end

-- 换弹动画进行中标志：换弹期间屏蔽自动/手动拉栓，避免拉栓打断换弹
local reloading = false

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
        this.main_track_states.final.isfinal = 1
        -- 丢枪后转到最终态
        return this.main_track_states.final
    end
    if (input == INPUT_INSPECT) then
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
    if (idle_state.timestamp ~= nil) then
        if (idle_state.timestamp ~= -1 and context:getCurrentTimestamp() - idle_state.timestamp > idle_state.ejection_time) then
            context:popShellFrom(0)
            idle_state.timestamp = -1
        end
    end
    -- 换弹动画播放完后清除换弹标志
    if (reloading and context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))) then
        reloading = false
    end
    -- 拉栓收尾：bolt 动画（约 1.57s）播放完并保持末帧后，用一段过渡平滑切到
    -- static_idle 并让主轨道停住，避免自然结束时轨道释放造成回弹跳动
    local bolt = this.main_track_states.bolt
    if (bolt ~= nil and bolt.timestamp ~= nil and bolt.timestamp ~= -1) then
        local elapsed = context:getCurrentTimestamp() - bolt.timestamp
        -- 仅在拉栓刚播完的一小段窗口内做收尾，避免误伤后续动画
        if (elapsed > 1540 and elapsed < 1720) then
            local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
            if (not context:isStopped(track)) then
                context:runAnimation("static_idle", track, false, PLAY_ONCE_STOP, 0.25)
                bolt.timestamp = -1
            end
        end
    end
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
