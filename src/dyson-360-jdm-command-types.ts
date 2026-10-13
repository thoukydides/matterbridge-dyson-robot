// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import {
    Dyson360JdmProp,
    Dyson360JdmPropValues
} from './dyson-360-jdm-props-types.js';
import {
    Dyson360JdmBoolean,
    Dyson360JdmCleanType,
    Dyson360JdmRoomCleanCtrl,
    Dyson360JdmEmptyObject,
    Dyson360JdmLanguage,
    Dyson360JdmMopPasses,
    Dyson360JdmVacuumMode,
    Dyson360JdmSplitLine,
    Dyson360JdmSpotZonePoints,
    Dyson360JdmUvSwitch,
    Dyson360JdmVacuumPasses,
    Dyson360JdmVersion,
    Dyson360JdmWaterLevel,
    Dyson360JdmRestriction,
    Dyson360JdmPackage,
    Dyson360JdmDockAction,
    Dyson360JdmDockActionCtrl,
    Dyson360JdmRoomPreferenceSet,
    Dyson360JdmPreferMode,
    Dyson360JdmConsumable
} from './dyson-360-jdm-types.js';

// =============================================================================
// MQTT topic: <type>/<sn>/command/jdm

// Dyson robot vacuum JDM command common fields
export interface Dyson360JdmCommandBase {
    msgId:                  string;                         // 32-bit integer as string
    version:                Dyson360JdmVersion;
    time?:                  string;                         // ISO datetime (from third-party integrations only?)
}

// -----------------------------------------------------------------------------
// Property access: prop.get and prop.set

// Request current values for specified properties
export interface Dyson360JdmCommandPropGet extends Dyson360JdmCommandBase {
	method:                 'prop.get';
    params: {
        property:           Dyson360JdmProp[]
    };
}

// Set specified property values
export interface Dyson360JdmCommandPropSet extends Dyson360JdmCommandBase {
	method:                 'prop.set';
    params:                 Dyson360JdmPropValues;
}

// -----------------------------------------------------------------------------
// Other commands: service.*

// Create or modify a schedule
export interface Dyson360JdmCommandServiceAddOrder extends Dyson360JdmCommandBase {
    method:                 'service.add_order';
    params: {
        areas:              [];
        day:                number;                         // Bitmap: bit 0 = Monday ... 6 = Sunday
        enable:             Dyson360JdmBoolean;
        hour:               number;
        id:                 number;                         // Existing or new schedule identifier
        is_global:          Dyson360JdmBoolean.False;
        map_id:             number;
        minute:             number;
        prefer_type:        Dyson360JdmPreferMode;
        repeat:             Dyson360JdmBoolean.True;
        room_count:         number;                         // Total zones in map, not schedule
        room_preference:    Dyson360JdmRoomPreferenceSet[];
        time_zone:          number;                         // Offset in seconds, e.g. 3600 = BST = UTC+1
        uv_switch:          Dyson360JdmUvSwitch[];          // Observed as 0 for zones being mop
    }
}

// Set furniture in active map (replaces all previous furniture)
export interface Dyson360JdmCommandServiceAdjustFurniture extends Dyson360JdmCommandBase {
    method:                 'service.adjust_furniture';
    params: {
        furniture_list:     string;                         // JSON encoded Dyson360JdmFurniture[]
        package:            Dyson360JdmPackage;
        timestamp:          number;                         // Seconds since epoch
    }
}

// Merge zones
export interface Dyson360JdmCommandServiceArrangeRoom extends Dyson360JdmCommandBase {
    method:                 'service.arrange_room';
    params: {
        lang:               Dyson360JdmLanguage;
        map_id:             number;
        room_ids:           number[];
    };
}

// Delete a map
export interface Dyson360JdmCommandServiceDelMap extends Dyson360JdmCommandBase {
    method:                 'service.del_map';
    params: {
        map_id:             number;
    };
}

// Delete a schedule
export interface Dyson360JdmCommandServiceDelOrder extends Dyson360JdmCommandBase {
    method:                 'service.del_order';
    params: {
        id:                 number;                         // Existing schedule identifier
    };
}

// Delete a zone (always fails; use service.arrange_room to merge with neighbour instead)
export interface Dyson360JdmCommandServiceDeleteRoom extends Dyson360JdmCommandBase {
    method:                 'service.delete_room';
    params: {
        is_preview:         Dyson360JdmBoolean;
        map_id:             number;
        room_id:            number;
    }
}

// Download a new voice (= SET-VOICE-LANGUAGE)
export interface Dyson360JdmCommandServiceDownloadVoiceType extends Dyson360JdmCommandBase {
    method:                 'service.download_voice_type';
    params:                 Dyson360JdmEmptyObject;         // Placeholder until parameters known
}

// Delete zone cleaning configuration
export interface Dyson360JdmCommandServiceErasePreference extends Dyson360JdmCommandBase {
    method:                 'service.erase_preference';
    params: {
        map_id:             number;
        prefer_type:        Dyson360JdmPreferMode.Custom;
        erase_ids:          number[];                       // = [zones[].id, ...]
    }
}

// Play a tone
export interface Dyson360JdmCommandServiceFindDevice extends Dyson360JdmCommandBase {
    method:                 'service.find_device';
    params:                 Dyson360JdmEmptyObject;         // No parameters
}

// Retrieve cleaning path on-demand
export interface Dyson360JdmCommandServiceGetCurPath extends Dyson360JdmCommandBase {
    method:                 'service.get_cur_path';
    params:                 Dyson360JdmEmptyObject;         // No parameters
}

// Retrieve a list of maps
export interface Dyson360JdmCommandServiceGetMapList extends Dyson360JdmCommandBase {
    method:                 'service.get_map_list';
    params:                 Dyson360JdmEmptyObject;         // No parameters
}

// Retrieve signature of schedules (use REST API to retrieve details)
export interface Dyson360JdmCommandServiceGetOrder extends Dyson360JdmCommandBase {
    method:                 'service.get_order';
    params:                 Dyson360JdmEmptyObject;         // No parameters
}

// Retrieve the per-zone cleaning configuration
export interface Dyson360JdmCommandServiceGetPreference extends Dyson360JdmCommandBase {
    method:                 'service.get_preference'
    params: {
        map_id:             number;
    }
}

// Poll progress downloading a new voice (= REQUEST-VOICE-DOWNLOAD-STATUS)
export interface Dyson360JdmCommandServiceGetVoiceDownload extends Dyson360JdmCommandBase {
    method:                 'service.get_voice_download';
    params:                 Dyson360JdmEmptyObject;         // Placeholder until parameters known
}

// Set a new name for a map
export interface Dyson360JdmCommandServiceRenameMap extends Dyson360JdmCommandBase {
    method:                 'service.rename_map';
    params: {
        map_id:             number;
        map_name:           string;
    };
}

// Set a new name for a zone
export interface Dyson360JdmCommandServiceRenameRoom extends Dyson360JdmCommandBase {
    method:                 'service.rename_room';
    params: {
        map_id:             number;
        room_id:            number;
        room_name:          string;
    }
}

// Reset the counter for a consumable
export interface Dyson360JdmCommandServiceResetConsumable extends Dyson360JdmCommandBase {
    method:                 'service.reset_consumable';
    params: {
        consumable:         Dyson360JdmConsumable;
    }
}

// Configure a spotZoneConfigured clean (begins on START)
export interface Dyson360JdmCommandServiceSetAreasStart extends Dyson360JdmCommandBase {
    method:                 'service.set_areas_start';
    params: {
        action:             0;
        clean_count:        Dyson360JdmMopPasses;           // = mopPasses-1 (0 = one pass, 1 = two passes)
        ctrl_value:         Dyson360JdmRoomCleanCtrl;
        dry_clean_count:    Dyson360JdmVacuumPasses;        // = dryPasses-1 (0 = one pass, 1 = two passes)
        mode:               Dyson360JdmCleanType;           // = cleanType
        uv_switch:          Dyson360JdmBoolean;
        water:              Dyson360JdmWaterLevel;          // = waterLevel
        wind:               Dyson360JdmVacuumMode;          // = vacuumPowerMode
        zone_points:        Dyson360JdmSpotZonePoints[];    // = spotZones
    }
}

// Select map to make active (only the active map can be cleaned, or should be modified)
export interface Dyson360JdmCommandServiceSetCurMap extends Dyson360JdmCommandBase {
    method:                 'service.set_cur_map';
    params: {
        map_id:             number;
    };
}

// Change the per-zone cleaning configuration
export interface Dyson360JdmCommandServiceSetPreference extends Dyson360JdmCommandBase {
    method:                 'service.set_preference';
    params: {
        map_id:             number;
        prefer_type:        Dyson360JdmPreferMode;
        room_preference:    Dyson360JdmRoomPreferenceSet[];
        uv_switch:          Dyson360JdmUvSwitch[];
    };
}

// Change per-zone cleaning configuration between standard and custom
export interface Dyson360JdmCommandServiceSetPreferenceType extends Dyson360JdmCommandBase {
    method:                 'service.set_preference_type';
    params: {
        prefer_type:        Dyson360JdmPreferMode;
    };
}

// Set timezone (for schedules)
export interface Dyson360JdmCommandServiceSetRobotTimeZone extends Dyson360JdmCommandBase {
    method:                 'service.set_robot_time_zone';
    params: {
        time_zone:          string;                         // e.g. 'Europe/London'
    }
}

// Start (= START) or pause (= PAUSE; follow by ABORT to end clean) cleaning
export interface Dyson360JdmCommandServiceSetRoomClean extends Dyson360JdmCommandBase {
    method:                 'service.set_room_clean';
    params: {
        clean_type:         0;
        ctrl_value:         Dyson360JdmRoomCleanCtrl;
        room_ids:           number[];                       // = unorderedZones (empty for pause)
    }
}

// Set all restrictions in active map (replaces all previous restrictions)
export interface Dyson360JdmCommandServiceSetVirtualWall extends Dyson360JdmCommandBase {
    method:                 'service.set_virtual_wall';
    params: {
        virwall: [
            number,         // Number of restrictions; 0 to delete all
            ...Dyson360JdmRestriction[]
        ];
    }
}

// Split a zone into two zones (resets zone name and type)
export interface Dyson360JdmCommandServiceSplitRoom extends Dyson360JdmCommandBase {
    method:                 'service.split_room'
    params: {
        lang:               Dyson360JdmLanguage;
        map_id:             number;
        room_id:            number;
        split_points:       Dyson360JdmSplitLine;
    }
}

// Create a new map by exploring (= START-MAPPING)
export interface Dyson360JdmCommandServiceStartExplore extends Dyson360JdmCommandBase {
    method:                 'service.start_explore'
    params: {
        mode:               0;                              // ?
    }
}

// Abort and return to dock (= ABORT)
export interface Dyson360JdmCommandServiceStartRecharge extends Dyson360JdmCommandBase {
    method:                 'service.start_recharge'
    params:                 Dyson360JdmEmptyObject;         // No parameters
}

// Start (= START-DOCK-ACTION) or stop (= ABORT-DOCK_ACTION) a dock action
export interface Dyson360JdmCommandServiceStartStationAct extends Dyson360JdmCommandBase {
    method:                 'service.start_station_act';
    params: {
        ctrl_value:         Dyson360JdmDockActionCtrl;      // START-DOCK-ACTION / ABORT-DOCK-ACTION
        station_act:        Dyson360JdmDockAction;          // = action
    }
}

// Cancel returning to dock, leaving robot where it is
export interface Dyson360JdmCommandServiceStopRecharge extends Dyson360JdmCommandBase {
    method:                 'service.stop_recharge'
    params:                 Dyson360JdmEmptyObject;         // No parameters
}