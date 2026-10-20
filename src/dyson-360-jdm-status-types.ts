// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import {
    Dyson360JdmPropResult,
    Dyson360JdmPropValues
} from './dyson-360-jdm-props-types.js';
import {
    Dyson360JdmCleanMode,
    Dyson360JdmEmptyObject,
    Dyson360JdmMapChange,
    Dyson360JdmMapChangeResult,
    Dyson360JdmMapListItem,
    Dyson360JdmMsg,
    Dyson360JdmPreferMode,
    Dyson360JdmResponseCode,
    Dyson360JdmResponseResult,
    Dyson360JdmRoomPreference,
    Dyson360JdmTaskStatus,
    Dyson360JdmUvSwitch
} from './dyson-360-jdm-types.js';

// =============================================================================
// MQTT topic: <type>/<sn>/status/jdm

// Dyson robot vacuum JDM status common fields
export interface Dyson360JdmStatusBase extends Dyson360JdmMsg {
    code?:                  Dyson360JdmResponseCode;
}

// -----------------------------------------------------------------------------
// Events: event.*

// Robot has finished building a new map
export interface Dyson360JdmStatusEventBuildMapFinishPost extends Dyson360JdmStatusBase {
    method:                 'event.BuildMapFinish.post';
    params:                 Dyson360JdmEmptyObject;                 // (no data)
}

// Robot back on dock and washed its roller after cleaning
export interface Dyson360JdmStatusEventCleanFinishPost extends Dyson360JdmStatusBase {
    method:                 'event.clean_finish.post';
    params: {
        clean_finish:       number;                                 // Seconds since epoch
    }
}

// Final status of a finished cleaning or mapping task
export interface Dyson360JdmStatusEventCleanRecordPost extends Dyson360JdmStatusBase {
    method:                 'event.clean_record.post';
    params: {
        clean_count:        number;                                 // e.g. 2
        clean_current_map:  number;                                 // e.g. 1000000002
        record_clean_area:  number;                                 // e.g. 756
        record_clean_mode:  Dyson360JdmCleanMode;
        record_start_time:  number;                                 // Seconds since epoch
        record_task_status: Dyson360JdmTaskStatus;
        record_use_time:    number;                                 // e.g. 8
    }
}

// Robot failed to locate itself on the map
export interface Dyson360JdmStatusEventLocateFailPost extends Dyson360JdmStatusBase {
    method:                 'event.locate_fail.post';
    params:                 Dyson360JdmEmptyObject;                 // (no data)
}

// A map has been modified
export interface Dyson360JdmStatusEventMapChangePost extends Dyson360JdmStatusBase {
    method:                 'event.map_change.post'
    params: {
        map_change?:         Dyson360JdmMapChangeResult;
    }
};

// Mapping has started
export interface Dyson360JdmStatusEventStartBuildMapPost extends Dyson360JdmStatusBase {
    method:                 'event.startBuildMap.post';
    params:                 Dyson360JdmEmptyObject;                 // (no data)
}

// Cleaning has started
export interface Dyson360JdmStatusEventStartCleanPost extends Dyson360JdmStatusBase {
    method:                 'event.startClean.post';
    params:                 Dyson360JdmEmptyObject;                 // (no data)
}

// A zone could not be reached for cleaning
export interface Dyson360JdmStatusEventUnableAllAreaRechargePost extends Dyson360JdmStatusBase {
    method:                 'event.Unable_all_area_recharge.post';
    params:                 Dyson360JdmEmptyObject;                 // (no data)
}

// -----------------------------------------------------------------------------
// Property access and updates: prop.*

// Requested property values (all requested properties returned)
export interface Dyson360JdmStatusPropGet extends Dyson360JdmStatusBase {
    method:                 'prop.get';
    data:                   Dyson360JdmPropValues;
}

// Pushed updates (changed values only)
export interface Dyson360JdmStatusPropPost extends Dyson360JdmStatusBase {
    method:                 'prop.post';
    params:                 Dyson360JdmPropValues;
}

// Result of setting property values
export interface Dyson360JdmStatusPropSet extends Dyson360JdmStatusBase {
    method:                 'prop.set';
    data?: {
        property:           Dyson360JdmPropResult[];
    }
}

// -----------------------------------------------------------------------------
// Other command responses: service.*

// Service method responses can indicate failure as either code=1 or data.result=1
export type Dyson360JdmDataFail =       { result:   Dyson360JdmResponseResult.Failure } | undefined;
export interface Dyson360JdmDataSuccess { result?:  Dyson360JdmResponseResult.Success }

// Responses without additional data
export interface Dyson360JdmStatusServiceNoData extends Dyson360JdmStatusBase {
    method?:                'service.add_order'                     // Schedule created or modified
                          | 'service.del_map'                       // Map deleted
                          | 'service.del_order'                     // Schedule deleted
                          | 'service.delete_room'                   // Zone deleted
                          | 'service.erase_preference'              // Per-zone cleaning configuration deleted
                          | 'service.find_device'                   // Tone played
                          | 'service.rename_map'                    // Map renamed
                          | 'service.reset_consumable'              // Consumable counter reset
                          | 'service.set_areas_start'               // spotZoneConfigured clean configured (but not started)
                          | 'service.set_cur_map'                   // Active map changed (duplicates data.result key)
                          | 'service.set_preference'                // Per-zone cleaning configuration changed
                          | 'service.set_preference_type'           // Per-zone cleaning configuration type changed
                          | 'service.set_robot_time_zone'           // Timezone set (for schedules)
                          | 'service.set_room_clean'                // Cleaning started or paused
                          | 'service.start_explore'                 // Mapping started
                          | 'service.start_recharge'                // Aborting an returning to dock
                          | 'service.start_station_act'             // Starting or aborting dock action
                          | 'service.stop_recharge'                 // Cancelled returning to dock
                            // Placeholders for responses with unknown additional data
                          | 'service.download_voice_type'           // = SET-VOICE-LANGUAGE
                          | 'service.get_voice_download'            // = REQUEST-VOICE-DOWNLOAD-STATUS
    data:                   Dyson360JdmDataFail | Dyson360JdmDataSuccess;
}

// Responses returning modified map details (data.result may be omitted success)
export interface Dyson360JdmStatusServiceMapEdited extends Dyson360JdmStatusBase {
    method?:                'service.adjust_furniture'              // Furniture has been replaced on active map
                          | 'service.arrange_room'                  // Zones have been merged
                          | 'service.rename_room'                   // Zone has been renamed
                          | 'service.set_virtual_wall'              // Restrictions have been replaced on active map (duplicates data keys)
                          | 'service.split_room';                   // Zone has been split into two zones
    data:                   Dyson360JdmDataFail | Dyson360JdmMapChange & {
        result?:            Dyson360JdmResponseResult;
    };
}

// Current cleaning path
export interface Dyson360JdmStatusServiceGetCurPath extends Dyson360JdmStatusBase {
    method?:                'service.get_cur_path'
    data:                   Dyson360JdmDataFail | Dyson360JdmDataSuccess & {
        cur_path:           number[];                               // (see cur_path property)
    }
}

// List of all maps
export interface Dyson360JdmStatusServiceGetMapList extends Dyson360JdmStatusBase {
    method?:                'service.get_map_list'
    data:                   Dyson360JdmDataFail | Dyson360JdmDataSuccess & {
        map_list:           Dyson360JdmMapListItem[];
    }
}

// Signature of schedules
export interface Dyson360JdmStatusServiceGetOrder extends Dyson360JdmStatusBase {
    method?:                'service.get_order'
    data:                   Dyson360JdmDataFail | Dyson360JdmDataSuccess & {
        order_data_lite: {
            total:          number;                                 // Total number of schedules
            enable:         number;                                 // Enabled schedules
            timestamp:      number;                                 // Seconds since epoch
            md5:            string;                                 // MD5 hash of schedules
        }
    }
}

// Per-zone cleaning configuration
export interface Dyson360JdmStatusServiceGetPreference extends Dyson360JdmStatusBase {
    method?:                'service.get_preference'
    data:                   Dyson360JdmDataFail | Dyson360JdmDataSuccess & {
        room?:              Dyson360JdmRoomPreference[];
        material:           [];
        prefer_on:          Dyson360JdmPreferMode;
        uv_switch?:         Dyson360JdmUvSwitch[];
    }
};

// =============================================================================
// MQTT topic: <type>/<sn>/status/jdm/map

export interface Dyson360JdmMapStatus {
    mapId?:                 number;
    message:                string;                                 // e.g. "Processing success"
    status:                 'SUCCESS';
}