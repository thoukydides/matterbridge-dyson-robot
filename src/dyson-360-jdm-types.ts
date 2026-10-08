// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

// JDM request methods
export type Dyson360JdmMethod =
  | 'prop.get'
  | 'prop.post'
  | 'prop.set'
  | 'service.add_order'
  | 'service.adjust_furniture'
  | 'service.arrange_room'
  | 'service.del_map'
  | 'service.del_order'
  | 'service.delete_room'
  | 'service.download_voice_type'
  | 'service.get_map_list'
  | 'service.get_order'
  | 'service.get_preference'
  | 'service.get_voice_download'
  | 'service.rename_map'
  | 'service.rename_room'
  | 'service.set_areas_start'
  | 'service.set_cur_map'
  | 'service.set_preference'
  | 'service.set_robot_time_zone'
  | 'service.set_room_clean'
  | 'service.set_virtual_wall'
  | 'service.split_room'
  | 'service.start_explore'
  | 'service.start_recharge'
  | 'service.start_station_act';

// JDM events pushed by the robot
export type Dyson360JdmEvent =
  | 'event.BuildMapStart.post'
  | 'event.BuildMapFinish.post'
  | 'event.clean_finish.post'
  | 'event.clean_record.post'
  | 'event.locate_fail.post'
  | 'event.map_change.post'
  | 'event.shortcut_instruction_task_change.post'
  | 'event.startBuildMap.post'
  | 'event.startClean.post'
  | 'event.Unable_all_area_recharge.post';

// Expected JDM protocol version(s)
export type Dyson360JdmVersion                  = '1.0.1';
export const JDM_VERSION: Dyson360JdmVersion    = '1.0.1';

// MQTT topic: <type>/<sn>/jdm/command

export interface Dyson360JdmRequest {
    msgId:                              string;
    version:                            Dyson360JdmVersion;
    method:                             Dyson360JdmMethod;
    params?:                            unknown;

}
// MQTT topic: <type>/<sn>/jdm/status

export interface Dyson360JdmResponse {
    method:                             Dyson360JdmMethod | Dyson360JdmEvent;
    code:                               number;
    result:                             unknown;
}

// Any JDM payload types
export type Dyson360Jdm = Dyson360JdmRequest | Dyson360JdmResponse