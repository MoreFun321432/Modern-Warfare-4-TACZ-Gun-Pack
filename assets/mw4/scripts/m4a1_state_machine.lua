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
              context:runAnimation("reload_tactical_empty_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("reload_tactical_empty_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
          else
              context:runAnimation("reload_tactical_empty", track, false, PLAY_ONCE_STOP, 0.2)
          end
      else
          if (ext >= 3) then
              context:runAnimation("reload_tactical_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("reload_tactical_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
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
              context:runAnimation("inspect_empty_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("inspect_empty_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
          else
              context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
          end
      else
          if (ext >= 3) then
              context:runAnimation("inspect_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
          elseif (ext >= 1) then
              context:runAnimation("inspect_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
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

-- 检视态：检测到开火模式切换输入时直接停止动画并返回闲置态
function inspect_state.transition(this, context, input)
    -- 快慢机（切换开火模式）立刻打断检视动画并回到闲置态
    if (input == INPUT_FIRE_SELECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))
        return this.main_track_states.idle
    end
    return main_track_states.inspect.transition(this, context, input)
end

-- 用元表的方式继承包内默认状态机
local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state,
        inspect = inspect_state
    }, {__index = main_track_states}),
    ADS_states = setmetatable({}, {__index = default.ADS_states})
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
        self.slide_states.normal
    }
end

-- 导出状态机
return M
