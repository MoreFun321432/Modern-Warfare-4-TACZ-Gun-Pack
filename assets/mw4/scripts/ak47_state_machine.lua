-- ============================================================================
-- M4A1 状态机（从底层重建）
-- 路径: assets/mw4/scripts/m4a1_state_machine.lua
-- 引用: display 中 "state_machine": "mw4:m4a1_state_machine"
--
-- 设计：
--   1. 继承包内默认状态机（空挂/移动/滑铲等基础行为）；
--   2. 换弹/检视按弹匣等级选动画（0/1/2 级，3 级兜底 2 级）；
--   3. 无快慢机轨道（本枪无 static/switch 动画，缺失动画由默认步枪兜底）；
--   4. ADS 使用官方行为：开镜播放 aim（缺失则默认步枪兜底），
--      换弹（主轨道播放）或瞄准进度减小时退出开镜。
-- ============================================================================

local default = require("mw4_default_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local ADS_TRACK = default.ADS_TRACK
local main_track_states = default.main_track_states

local inspect_state = setmetatable({}, {__index = main_track_states.inspect})
local idle_state = setmetatable({}, {__index = main_track_states.idle})

local static_track_top = default.static_track_top

-- 相当于 obj.value++（用于分配快慢机轨道）
local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

-- 检查当前是否还有弹药（同时检查枪管和弹匣）
local function isNoAmmo(context)
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

  -- 播放换弹动画：空仓/战术 × 弹匣等级（1、2 级用 xmag_1，3 级弹鼓用 xmag_2）
  local function runReloadAnimation(context)
      local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
      local ext = context:getMagExtentLevel()
      if (isNoAmmo(context)) then
          if (ext >= 3) then
              context:runAnimation("reload_tactical_empty_xmag123", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("reload_tactical_empty_xmag123", track, false, PLAY_ONCE_STOP, 0.2)
          else
              context:runAnimation("reload_tactical_empty", track, false, PLAY_ONCE_STOP, 0.2)
          end
      else
          if (ext >= 3) then
              context:runAnimation("reload_tactical_xmag123", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("reload_tactical_xmag123", track, false, PLAY_ONCE_STOP, 0.2)
          else
              context:runAnimation("reload_tactical", track, false, PLAY_ONCE_STOP, 0.2)
          end
      end
  end
  
  -- 播放检视动画：普通/空仓 × 弹匣等级（1、2 级用 xmag_1，3 级弹鼓用 xmag_2）
  local function runInspectAnimation(context)
      local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
      local ext = context:getMagExtentLevel()
      if (isNoAmmo(context)) then
          if (ext >= 3) then
              context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
          else
              context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
          end
      else
          if (ext >= 3) then
              context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
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
        local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
        -- 停下快慢机拨动动画
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
                -- 空仓时改用 put_away_empty，收枪过程中也保持空仓姿态
        local putAwayAnimation = "put_away"
        if ((not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)) then
            putAwayAnimation = "put_away_empty"
        end
        context:runAnimation(putAwayAnimation, track, false, PLAY_ONCE_HOLD, put_away_time * 0.75)
        context:setAnimationProgress(track, 1, true)
        context:adjustAnimationProgress(track, -put_away_time, false)
        return this.main_track_states.final
    end
    if (input == INPUT_INSPECT) then
        runInspectAnimation(context)
        return inspect_state
    end
    return main_track_states.idle.transition(this, context, input)
end

-- 检视态：检视进行中忽略重复的检视输入（避免动画重开导致音效重叠）；
-- 检测到开火模式切换输入时直接停止动画并返回闲置态
function inspect_state.transition(this, context, input)
    if (input == INPUT_INSPECT) then
        return nil
    end
    -- 快慢机（切换开火模式）立刻打断检视动画并回到闲置态
    if (input == INPUT_FIRE_SELECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))
        return this.main_track_states.idle
    end
    return main_track_states.inspect.transition(this, context, input)
end

-- ============================================================================
-- 快慢机（开火模式）轨道：static_semi / static_auto 保持拨杆姿态，
-- switch_semi / switch_auto 播放拨动动画（自带音效标记）
-- ============================================================================
local FIRE_MODE_TRACK = increment(static_track_top)
local SWITCH_MODE_TRACK = increment(static_track_top)

local fire_mode_state = {
    -- 半自动状态
    semi = {},
    -- 全自动状态
    auto = {},
    -- 掏枪状态
    draw = {}
}

-- 掏枪时检测当前射击模式，切到对应姿态
function fire_mode_state.draw.update(this, context)
    context:trigger(this.INPUT_MODE_DRAW)
end

function fire_mode_state.draw.transition(this, context, input)
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

function fire_mode_state.semi.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
    end
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

function fire_mode_state.semi.transition(this, context, input)
    if (input == this.INPUT_MODE_AUTO) then
        local switchTrack = context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)
        -- 上一次拨杆动画（含音效）还没播完就忽略这次切换，避免动画/音效叠加
        if (not context:isStopped(switchTrack)) then
            return nil
        end
        context:runAnimation("switch_auto", switchTrack, false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.auto
    end
    -- 开火/换弹/检视时停掉拨动动画，避免两个轨道叠加导致衔接错位
    if (input == INPUT_SHOOT or input == INPUT_RELOAD or input == INPUT_INSPECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end

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

function fire_mode_state.auto.transition(this, context, input)
    if (input == this.INPUT_MODE_SEMI) then
        local switchTrack = context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)
        -- 上一次拨杆动画（含音效）还没播完就忽略这次切换，避免动画/音效叠加
        if (not context:isStopped(switchTrack)) then
            return nil
        end
        context:runAnimation("switch_semi", switchTrack, false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.semi
    end
    if (input == INPUT_SHOOT or input == INPUT_RELOAD or input == INPUT_INSPECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end

-- 用元表的方式继承包内默认状态机
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
