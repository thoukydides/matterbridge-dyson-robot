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
    Dyson360JdmMsgBase,
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
export interface Dyson360JdmStatusBase extends Dyson360JdmMsgBase {
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
export interface JdmStatusNoDataBase extends Dyson360JdmStatusBase {
    data:                   Dyson360JdmDataFail | Dyson360JdmDataSuccess;
}
/* eslint-disable max-len */
export interface Dyson360JdmStatusServiceAddOrder           extends JdmStatusNoDataBase { method?: 'service.add_order';             } // Schedule created or modified
export interface Dyson360JdmStatusServiceDelMap             extends JdmStatusNoDataBase { method?: 'service.del_map';               } // Map deleted
export interface Dyson360JdmStatusServiceDelOrder           extends JdmStatusNoDataBase { method?: 'service.del_order';             } // Schedule deleted
export interface Dyson360JdmStatusServiceDeleteRoom         extends JdmStatusNoDataBase { method?: 'service.delete_room';           } // Zone deleted
export interface Dyson360JdmStatusServiceErasePreference    extends JdmStatusNoDataBase { method?: 'service.erase_preference';      } // Per-zone cleaning configuration deleted
export interface Dyson360JdmStatusServiceFindDevice         extends JdmStatusNoDataBase { method?: 'service.find_device';           } // Tone played
export interface Dyson360JdmStatusServiceRenameMap          extends JdmStatusNoDataBase { method?: 'service.rename_map';            } // Map renamed
export interface Dyson360JdmStatusServiceResetConsumable    extends JdmStatusNoDataBase { method?: 'service.reset_consumable';      } // Consumable counter reset
export interface Dyson360JdmStatusServiceSetAreasStart      extends JdmStatusNoDataBase { method?: 'service.set_areas_start';       } // spotZoneConfigured clean configured (but not started); returns code = data.result = 1?
export interface Dyson360JdmStatusServiceSetCurMap          extends JdmStatusNoDataBase { method?: 'service.set_cur_map';           } // Active map changed (duplicates data.result key)
export interface Dyson360JdmStatusServiceSetPreference      extends JdmStatusNoDataBase { method?: 'service.set_preference';        } // Per-zone cleaning configuration changed
export interface Dyson360JdmStatusServiceSetPreferenceType  extends JdmStatusNoDataBase { method?: 'service.set_preference_type';   } // Per-zone cleaning configuration type changed
export interface Dyson360JdmStatusServiceSetRobotTimeZone   extends JdmStatusNoDataBase { method?: 'service.set_robot_time_zone';   } // Timezone set (for schedules)
export interface Dyson360JdmStatusServiceSetRoomClean       extends JdmStatusNoDataBase { method?: 'service.set_room_clean';        } // Cleaning started or paused
export interface Dyson360JdmStatusServiceStartExplore       extends JdmStatusNoDataBase { method?: 'service.start_explore';         } // Mapping started
export interface Dyson360JdmStatusServiceStartRecharge      extends JdmStatusNoDataBase { method?: 'service.start_recharge';        } // Aborting an returning to dock
export interface Dyson360JdmStatusServiceStartStationAct    extends JdmStatusNoDataBase { method?: 'service.start_station_act';     } // Starting or aborting dock action; returns code = data.result = 1?
export interface Dyson360JdmStatusServiceStopRecharge       extends JdmStatusNoDataBase { method?: 'service.stop_recharge';         } // Cancelled returning to dock
// Placeholders for responses with unknown additional data
export interface Dyson360JdmStatusServiceDownloadVoiceType  extends JdmStatusNoDataBase { method?: 'service.download_voice_type';   } // = SET-VOICE-LANGUAGE
export interface Dyson360JdmStatusServiceGetVoiceDownload   extends JdmStatusNoDataBase { method?: 'service.get_voice_download';    } // = REQUEST-VOICE-DOWNLOAD-STATUS
/* eslint-enable max-len */

// Responses returning modified map details (data.result may be omitted success)
export interface JdmStatusMapDataBase extends Dyson360JdmStatusBase {
    data:                   Dyson360JdmDataFail | Dyson360JdmMapChange & {
        result?:            Dyson360JdmResponseResult;
    };
}
/* eslint-disable max-len */
export interface Dyson360JdmStatusServiceAdjustFurniture    extends JdmStatusMapDataBase { method?: 'service.adjust_furniture';     } // Furniture has been replaced on active map
export interface Dyson360JdmStatusServiceArrangeRoom        extends JdmStatusMapDataBase { method?: 'service.arrange_room';         } // Zones have been merged
export interface Dyson360JdmStatusServiceRenameRoom         extends JdmStatusMapDataBase { method?: 'service.rename_room';          } // Zone has been renamed
export interface Dyson360JdmStatusServiceSetVirtualWall     extends JdmStatusMapDataBase { method?: 'service.set_virtual_wall';     } // Restrictions have been replaced on active map (duplicates data keys)
export interface Dyson360JdmStatusServiceSplitRoom          extends JdmStatusMapDataBase { method?: 'service.split_room';           } // Zone has been split into two zones
/* eslint-enable max-len */

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