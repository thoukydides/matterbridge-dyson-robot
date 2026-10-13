// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import {
    Dyson360JdmBackWashType,
    Dyson360JdmBoolean,
    Dyson360JdmLanguage,
    Dyson360JdmDockState,
    Dyson360JdmWorkMode,
    Dyson360JdmSweepType,
    Dyson360JdmOrderTotal,
    Dyson360JdmStatusValue,
    Dyson360JdmWorkTime,
    Dyson360JdmResponseCode,
    Dyson360JdmOutOfBoxState,
    Dyson360JdmPrivacy,
    Dyson360JdmDustAction
} from './dyson-360-jdm-types.js';

// Dyson robot vacuum JDM property value types
export interface Dyson360JdmPropValues {
    airdry_frequency?:          number;                         // = airDryFrequency
    alarm?:                     Dyson360JdmBoolean;             // Voice notifications (≠ CURRENT-STATE alarm is for find-my-robot chime)
    auto_water_complete_flag?:  Dyson360JdmBoolean | null;      // Plumbed-in dock?
    auto_water_self_check?:     Dyson360JdmBoolean | null;      // Plumbed-in dock?
    back_to_wash?:              Dyson360JdmBoolean;             // Returning to dock to wash roller
    back_wash_time?:            number;                         // = backWashTime
    back_wash_type?:            Dyson360JdmBackWashType;        // = backWashType
    charge_state?:              Dyson360JdmBoolean;             // On dock charging contacts
    child_lock?:                Dyson360JdmBoolean;             // = childLock
    clean_wash_attachment?:     null;                           // ?
    cleaning_area?:             number;                         // Area cleaned                                 dm²
    cleaning_time?:             number;                         // = cleanDuration                              (but minutes, not seconds)
    cur_path?:                  number[];                       // = globalPosition [id, x[0], y[0], angle[0], update[0], ..., timestamp]
    current_map_id?:            number;                         // = persistentMapId                            (number, not string)
    detergent_consumed?:        number;                         // ?
    detergent?:                 Dyson360JdmBoolean;             // = detergent
    dock_hypa?:                 number;                         // = consumables[{ type: 'dockFilter' }]        (% used?, absent = -1)
    dust_action?:               Dyson360JdmDustAction;          // Auto-emptying dustbin on dock
    dust_auto_state?:           Dyson360JdmBoolean;             // = collectDustOnSelfClean
    empty_bin_time?:            null;                           // ?
    empty_bin_type?:            null;                           // ?
    fault?:                     number;                         // = activeFaults[].faultCode, 0 for none
    global_clean_status?:       number | null;                  // ?
    hot_water_mop?:             Dyson360JdmBoolean;             // = hotWaterMop
    hot_water_switch?:          Dyson360JdmBoolean;             // = hotWaterSwitch
    hypa?:                      number;                         // = consumables[{ type: 'robotFilter' }]       (% used?, absent = -1)
    ioniser?:                   number;                         // = consumables[{ type: 'ioniserCartridge' }]  (% used?, absent = -1)
    main_brush?:                number;                         // = consumables[{ type: 'brushBar' }]          (% used?, absent = -1)
    mop_life?:                  number;                         // = consumables[{ type: 'mopRoller' }]         (% used?, absent = -1)
    mop_pad_life?:              number | null;                  // = consumables[{ type: 'mopPad' }]            (% used?, absent = -1)
    oob_state?:                 Dyson360JdmOutOfBoxState;       // = outOfBoxState
    order_total?:               Dyson360JdmOrderTotal;          // Number of schedules on active map
    privacy?:                   Dyson360JdmPrivacy;             // Privacy policy
    quantity?:                  number;                         // = batteryChargeLevel                         0-100%
    quiet_begin_time?:          number;                         // = doNotDisturbMode.startTime                 (minutes since midnight)
    quiet_end_time?:            number;                         // = doNotDisturbMode.endTime                   (minutes since midnight)
    quiet_is_open?:             Dyson360JdmBoolean;             // = doNotDisturbMode.isOn
    robot_auto_updown_type?:    string | null;                  // Internal model number e.g '804A'
    side_brush?:                number;                         // = consumables[{ type: 'sideBrushes' }]       (% used?, absent = -1)
    station_act?:               Dyson360JdmDockState;           // = dockState
    status?:                    Dyson360JdmStatusValue;         // ≈ state (secondary signal; use work_mode)
    store_demo_mode?:           Dyson360JdmBoolean | null;      // ?
    sweep_type?:                Dyson360JdmSweepType;           // ?
    taskBeginTs?:               null;                           // ?
    voice_type?:                Dyson360JdmLanguage;            // = voiceLanguage
    volume?:                    number;                         // = volume                                     0-100%
    wash_back_frequency?:       number;                         // = backWashFrequency
    work_mode?:                 Dyson360JdmWorkMode;            // ≈ state (but very finely grained)
    work_time?:                 Dyson360JdmWorkTime;            // Countdown of dock actions
}

// Dyson robot vacuum JDM property names
export type Dyson360JdmProp = // keyof Dyson360JdmPropValues
    'airdry_frequency'
  | 'alarm'
  | 'auto_water_complete_flag'
  | 'auto_water_self_check'
  | 'back_to_wash'
  | 'back_wash_time'
  | 'back_wash_type'
  | 'charge_state'
  | 'child_lock'
  | 'clean_wash_attachment'
  | 'cleaning_area'
  | 'cleaning_time'
  | 'cur_path'
  | 'current_map_id'
  | 'detergent_consumed'
  | 'detergent'
  | 'dock_hypa'
  | 'dust_action'
  | 'dust_auto_state'
  | 'empty_bin_time'
  | 'empty_bin_type'
  | 'fault'
  | 'global_clean_status'
  | 'hot_water_mop'
  | 'hot_water_switch'
  | 'hypa'
  | 'ioniser'
  | 'main_brush'
  | 'mop_life'
  | 'mop_pad_life'
  | 'oob_state'
  | 'order_total'
  | 'privacy'
  | 'quantity'
  | 'quiet_begin_time'
  | 'quiet_end_time'
  | 'quiet_is_open'
  | 'robot_auto_updown_type'
  | 'side_brush'
  | 'station_act'
  | 'status'
  | 'store_demo_mode'
  | 'sweep_type'
  | 'taskBeginTs'
  | 'voice_type'
  | 'volume'
  | 'wash_back_frequency'
  | 'work_mode'
  | 'work_time';

// Dyson robot vacuum JDM property prop.set status
export interface Dyson360JdmPropResult {
    prop:                       Dyson360JdmProp;
    code:                       Dyson360JdmResponseCode;
}