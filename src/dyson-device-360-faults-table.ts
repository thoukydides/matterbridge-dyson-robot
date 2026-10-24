// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025-2026 Alexander Thoukydides

import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { Dyson360Faults, Dyson360State } from './dyson-360-types.js';

/* eslint-disable max-len */

// Mapping of a single fault to RVC Operational State and Power Source clusters
export interface Dyson360FaultDetail {
    msg:            string;
    opError?:       keyof typeof RvcOperationalState.ErrorState;
    batFault?:      keyof typeof PowerSource.BatFault;
    chargeFault?:   keyof typeof PowerSource.BatChargeFault;
    statusOnly?:    boolean;
}

// Fault code patterns and ranges
type FaultLevel1 = `${number}.#.#`;
type FaultLevel2 = `${number}.${number}.#`;
type FaultLevel3 = `${number}.${number}.${number}`;
export type Dyson360FaultPattern = FaultLevel1 | FaultLevel2 | FaultLevel3;
export type Dyson360FaultRange = [FaultLevel1, FaultLevel1] | [FaultLevel2, FaultLevel2] | [FaultLevel3, FaultLevel3];
export type Dyson360FaultPatternOrRange = Dyson360FaultPattern | Dyson360FaultRange;

// Dyson robot vacuum states that map to errors
export const DYSON_360_FAULT_STATES = new Map<Dyson360State, Dyson360FaultDetail>([
    [Dyson360State.MachineOff,              { msg: 'Offline'                                                                                                    }],
    [Dyson360State.FaultCallHelpline,       { msg: 'Call Dyson helpline'                                                                                        }],
    [Dyson360State.FaultContactHelpline,    { msg: 'Contact Dyson helpline'                                                                                     }],
    [Dyson360State.FaultCritical,           { msg: 'Critical fault'                                                                                             }],
    [Dyson360State.FaultGettingInfo,        { msg: 'Getting info'                                                                                               }],
    [Dyson360State.FaultLost,               { msg: 'Lost location',                                 opError: 'UnableToCompleteOperation'                        }],
    [Dyson360State.FaultOnDock,             { msg: 'Fault on dock'                                                                                              }],
    [Dyson360State.FaultOnDockCharged,      { msg: 'Fault on dock (charged)'                                                                                    }],
    [Dyson360State.FaultOnDockCharging,     { msg: 'Fault on dock (charging)'                                                                                   }],
    [Dyson360State.FaultReplaceOnDock,      { msg: 'Place on dock',                                 opError: 'FailedToFindChargingDock'                         }],
    [Dyson360State.FaultReturnToDock,       { msg: 'Unable to return to dock',                      opError: 'FailedToFindChargingDock'                         }],
    [Dyson360State.FaultRunningDiagnostic,  { msg: 'Running diagnostic'                                                                                         }],
    [Dyson360State.FaultUserRecoverable,    { msg: 'User-recoverable fault',                        opError: 'Stuck'                                            }],
    [Dyson360State.FullCleanAbandoned,      { msg: 'Abandoned clean',                               opError: 'UnableToCompleteOperation'                        }]
]);

// Dyson robot vacuum fault category mapping to errors
export type Dyson360FaultCategory = keyof Dyson360Faults;
export const DYSON_360_FAULT_CATEGORIES: Record<Dyson360FaultCategory, Dyson360FaultDetail> = {
    AIRWAYS:                    { msg: 'Airways fault',             /* Lights: 1 red */             opError: 'DustBinFull'                                      },
    BRUSH_BAR_AND_TRACTION:     { msg: 'Robot stuck',               /* Lights: 2 red */             opError: 'BrushJammed'                                      },
    CHARGE_STATION:             { msg: 'Unable to return to dock',  /* Lights: 3 red */             opError: 'FailedToFindChargingDock'                         },
    OPTICS:                     { msg: 'Optical sensors fault',     /* Lights: 4 red */             opError: 'NavigationSensorObscured'                         },
    LIFT:                       { msg: 'Robot lifted',                                              opError: 'Stuck'                                            },
    LOST:                       { msg: 'Navigation fault',          /* Lights: Red battery */       opError: 'UnableToCompleteOperation'                        },
    BATTERY:                    { msg: 'Battery fault',                                             batFault: 'Unspecified', chargeFault: 'Unspecified'         }
};

// Specific faults/ranges in 360 Eye / 360 Heurist / 360 VisNav format
export const DYSON_360_FAULT_TRIPLET_CODES: [Dyson360FaultPatternOrRange, Dyson360FaultDetail][] = [
    // Dyson 360 Eye faults (observed)
    ['1.0.-1',                  { msg: 'Bin full or airways blocked',                               opError: 'DustBinFull'                                      }],
    ['3.5.-1',                  { msg: 'Brush bar or tracks stuck',                                 opError: 'BrushJammed'                                      }],
    ['7.0.-1',                  { msg: 'Bin missing or not detected',                               opError: 'DustBinMissing'                                   }],
    ['9.0.-1',                  { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }],

    // Dyson 360 Vis Nav faults
    // Observed but not documented by Dyson
    ['3.24.#',                  { msg: 'Stuck',                                                     opError: 'Stuck'                                            }],
    // https://support.dyson.com.au/supportHome/Vacuums/Robots/360visnav/304640-01/using-your-robot/fault-codes
    ['1.0.#',                   { msg: 'Airways blocked',                                           opError: 'DustBinFull'                                      }],
    ['1.2.#',                   { msg: 'Check bin level',                                           opError: 'DustBinFull'                                      }],
    ['1.4.#',                   { msg: 'Vacuum calibration missing'                                                                                             }],
    [['1.5.#', '1.6.#'],        { msg: 'Filter not detected',                                       opError: 'DustBinMissing'                                   }],
    [['1.7.#', '1.8.#'],        { msg: 'Check airways',                                             opError: 'DustBinFull'                                      }],
    ['3.3.#',                   { msg: 'Brush bar motor too hot',                                   opError: 'BrushJammed'                                      }],
    ['3.4.#',                   { msg: 'Wheel motor too hot',                                       opError: 'WheelsJammed'                                     }],
    ['3.5.#',                   { msg: 'Brush bar stuck',                                           opError: 'BrushJammed'                                      }],
    ['3.6.#',                   { msg: 'Wheel stuck',                                               opError: 'WheelsJammed'                                     }],
    [['3.7.#', '3.8.#'],        { msg: 'Wheel hardware failure',                                    opError: 'WheelsJammed'                                     }],
    ['3.9.#',                   { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }],
    [['3.10.#', '3.15.#'],      { msg: 'ADC error',                                                 opError: 'NavigationSensorObscured'                         }],
    ['3.16.#',                  { msg: 'Brush bar stuck',                                           opError: 'BrushJammed'                                      }],
    ['3.16.12',                 { msg: 'Brush bar motor too hot',                                   opError: 'BrushJammed'                                      }],
    ['3.16.13',                 { msg: 'Brush bar motor too cold',                                  opError: 'BrushJammed'                                      }],
    ['3.16.16',                 { msg: 'Brush bar motor winding failure',                           opError: 'BrushJammed'                                      }],
    ['3.16.30',                 { msg: 'Brush bar communication failure',                           opError: 'BrushJammed'                                      }],
    ['3.16.33',                 { msg: 'Brush bar communication failure',                           opError: 'BrushJammed'                                      }],
    ['3.17.#',                  { msg: 'Wheel stuck',                                               opError: 'WheelsJammed'                                     }],
    ['3.19.#',                  { msg: 'Wheel stuck',                                               opError: 'WheelsJammed'                                     }],
    [['3.20.#', '3.21.#'],      { msg: 'Edge actuator stuck',                                       opError: 'BrushJammed'                                      }],
    ['3.22.#',                  { msg: 'Edge actuator switch stuck',                                opError: 'BrushJammed'                                      }],
    ['3.23.#',                  { msg: 'Brush bar stuck',                                           opError: 'BrushJammed'                                      }],
    ['3.23.12',                 { msg: 'Brush bar motor too hot',                                   opError: 'BrushJammed'                                      }],
    ['3.23.13',                 { msg: 'Brush bar motor too cold',                                  opError: 'BrushJammed'                                      }],
    ['3.23.16',                 { msg: 'Brush bar motor winding failure',                           opError: 'BrushJammed'                                      }],
    ['3.23.30',                 { msg: 'Brush bar communication failure',                           opError: 'BrushJammed'                                      }],
    ['3.23.33',                 { msg: 'Brush bar communication failure',                           opError: 'BrushJammed'                                      }],
    [['3.100.#', '3.112.#'],    { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['3.113.#',                 { msg: 'Left wheel - Wheel motor too cold',                         opError: 'WheelsJammed'                                     }],
    [['3.114.#', '3.115.#'],    { msg: 'Left wheel - Wheel motor too hot',                          opError: 'WheelsJammed'                                     }],
    [['3.116.#', '3.120.#'],    { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['3.121.#',                 { msg: 'Right wheel - Wheel motor too cold',                        opError: 'WheelsJammed'                                     }],
    [['3.122.#', '3.123.#'],    { msg: 'Right wheel - Wheel motor too hot',                         opError: 'WheelsJammed'                                     }],
    [['3.124.#', '3.128.#'],    { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['3.129.#',                 { msg: 'Brush bar motor too cold',                                  opError: 'BrushJammed'                                      }],
    [['3.130.#', '3.131.#'],    { msg: 'Brush bar motor too hot',                                   opError: 'BrushJammed'                                      }],
    [['5.0.#', '5.2.#'],        { msg: 'Battery pack - ADC error',                                  batFault: 'Unspecified', chargeFault: 'Unspecified'         }],
    ['5.3.#',                   { msg: 'Battery locked out',                                        batFault: 'Unspecified', chargeFault: 'SafetyTimeout'       }],
    ['5.4.#',                   { msg: 'Battery disconnected',                                      batFault: 'Unspecified', chargeFault: 'BatteryAbsent'       }],
    ['5.5.#',                   { msg: 'Battery low voltage',                                       batFault: 'Unspecified', chargeFault: 'BatteryUnderVoltage' }],
    ['5.6.#',                   { msg: 'Battery charge required',                                   batFault: 'Unspecified', opError: 'LowBattery'              }],
    [['5.7.#', '5.9.#'],        { msg: 'Battery too hot',                                           batFault: 'OverTemp',    chargeFault: 'BatteryTooHot'       }],
    ['5.10.#',                  { msg: 'Unable to shut down'                                                                                                    }],
    ['7.#.#',                   { msg: 'Bin not detected',                                          opError: 'DustBinMissing'                                   }],
    ['9.#.#',                   { msg: 'Unable to dock',                                            opError: 'FailedToFindChargingDock'                         }],
    [['11.0.#', '11.1.#'],      { msg: 'Distance sensor calibration error',                         opError: 'NavigationSensorObscured'                         }],
    ['11.2.#',                  { msg: 'ADC error',                                                 opError: 'NavigationSensorObscured'                         }],
    ['11.3.#',                  { msg: 'Distance sensor error',                                     opError: 'NavigationSensorObscured'                         }],
    ['11.5.#',                  { msg: 'Camera calibration error',                                  opError: 'NavigationSensorObscured'                         }],
    ['11.6.#',                  { msg: 'Camera unplugged',                                          opError: 'NavigationSensorObscured'                         }],
    ['11.7.#',                  { msg: 'Distance sensor error',                                     opError: 'NavigationSensorObscured'                         }],
    ['11.8.#',                  { msg: 'Distance sensor calibration error',                         opError: 'NavigationSensorObscured'                         }],
    ['11.9.#',                  { msg: 'Distance sensor calibration error',                         opError: 'NavigationSensorObscured'                         }],
    ['11.10.#',                 { msg: 'Drop detected at start of clean',                           opError: 'UnableToStartOrResume'                            }],
    [['11.11.#', '11.14.#'],    { msg: 'ADC error',                                                 opError: 'NavigationSensorObscured'                         }],
    ['11.15.#',                 { msg: 'Unclean distance sensor',                                   opError: 'NavigationSensorObscured'                         }],
    ['11.16.#',                 { msg: 'Distance sensor error',                                     opError: 'NavigationSensorObscured'                         }],
    ['11.17.#',                 { msg: 'Distance sensor communication error',                       opError: 'NavigationSensorObscured'                         }],
    ['11.18.#',                 { msg: 'Distance sensor calibration error',                         opError: 'NavigationSensorObscured'                         }],
    ['11.19.#',                 { msg: 'Drop sensor maintenance alert',                             opError: 'NavigationSensorObscured'                         }],
    ['11.20.#',                 { msg: 'Non-drop sensor maintenance alert',                         opError: 'NavigationSensorObscured'                         }],
    ['11.21.#',                 { msg: 'Distance sensor error',                                     opError: 'NavigationSensorObscured'                         }],
    ['11.22.#',                 { msg: 'Unclean distance sensor',                                   opError: 'NavigationSensorObscured'                         }],
    [['13.0.-1', '13.0.1'],     { msg: 'Dirty obstacle sensors - Cannot find a route back to dock', opError: 'NavigationSensorObscured'                         }],
    [['13.1.#', '13.2.#'],      { msg: 'Navigation sensor error',                                   opError: 'NavigationSensorObscured'                         }],
    ['13.3.-1',                 { msg: 'Low battery',                                               opError: 'LowBattery'                                       }],
    ['13.3.1',                  { msg: 'Dirty obstacle sensors - Low battery',                      opError: 'LowBattery'                                       }],
    ['13.4.#',                  { msg: 'Low battery at clean start',                                opError: 'LowBattery'                                       }],
    ['13.5.#',                  { msg: 'Camera exposure not settled',                               opError: 'NavigationSensorObscured'                         }],
    [['13.6.#', '13.7.#'],      { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['13.8.#',                  { msg: 'Failed to set state'                                                                                                    }],
    ['13.9.#',                  { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['13.10.#',                 { msg: 'Insufficient features to find location',                    opError: 'CannotReachTargetArea'                            }],
    ['13.12.#',                 { msg: 'High uncertainty in discovery',                             opError: 'CannotReachTargetArea'                            }],
    ['13.13.#',                 { msg: 'Persistent location lost',                                  opError: 'CannotReachTargetArea'                            }],
    ['13.14.#',                 { msg: 'Discovered wrong floor',                                    opError: 'CannotReachTargetArea'                            }],
    ['13.15.#',                 { msg: 'Persistent location jump',                                  opError: 'CannotReachTargetArea'                            }],
    ['13.16.#',                 { msg: 'Software error'                                                                                                         }],
    ['13.17.#',                 { msg: 'Replacement fault'                                                                                                      }],
    ['13.18.#',                 { msg: 'Low battery',                                               opError: 'LowBattery'                                       }],
    [['13.101.#', '13.102.#'],  { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    [['13.105.#', '13.106.#'],  { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['13.132.#',                { msg: 'Internal temperature too cold',                             batFault: 'UnderTemp'                                       }],
    [['13.133.#', '13.134.#'],  { msg: 'Internal temperature too hot',                              batFault: 'OverTemp'                                        }],
    [['13.135.#', '13.151.#'],  { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    [['13.157.#', '13.162.#'],  { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['17.0.#',                  { msg: 'Software error'                                                                                                         }],
    ['17.2.#',                  { msg: 'Configuration data missing'                                                                                             }],
    ['17.3.#',                  { msg: 'Software error'                                                                                                         }],
    ['17.4.#',                  { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['17.5.#',                  { msg: 'Configuration data missing'                                                                                             }],
    [['17.6.#', '17.8.#'],      { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['17.9.#',                  { msg: 'Inconsistent Sensor Time - Software error'                                                                              }],
    ['17.10.#',                 { msg: 'Software error'                                                                                                         }],
    ['17.11.#',                 { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['17.12.#',                 { msg: 'Edge actuator - Brush bar motor too hot',                   opError: 'BrushJammed'                                      }],
    ['17.13.#',                 { msg: 'Could not start LCD screen'                                                                                             }],
    ['17.14.#',                 { msg: 'Low level PCB communication error'                                                                                      }],
    ['17.15.#',                 { msg: 'Wheel stuck',                                               opError: 'WheelsJammed'                                     }],
    ['17.16.#',                 { msg: 'Failed to upgrade'                                                                                                      }],
    ['17.17.#',                 { msg: 'Low memory'                                                                                                             }],
    ['17.18.#',                 { msg: 'Failed to save map'                                                                                                     }],
    ['17.19.#',                 { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['17.20.#',                 { msg: 'Unable to upload robot logs'                                                                                            }],
    ['17.21.#',                 { msg: 'DHCP - Software error'                                                                                                  }],
    ['17.22.#',                 { msg: 'IMU data error'                                                                                                         }],
    ['17.23.#',                 { msg: 'Zoned map error',                                           opError: 'CannotReachTargetArea'                            }],
    [['17.100.#', '17.703.#'],  { msg: 'Unhandled alert'                                                                                                        }],
    [['19.0.#', '19.2.#'],      { msg: 'Robot too hot',                                             batFault: 'OverTemp'                                        }],
    ['19.3.#',                  { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['19.4.#',                  { msg: 'ADC error',                                                 opError: 'NavigationSensorObscured'                         }],
    ['19.5.#',                  { msg: 'Wheel motor too hot',                                       opError: 'WheelsJammed'                                     }],
    ['19.6.#',                  { msg: 'Charge contact too hot',                                    chargeFault: 'AmbientTooHot'                                }],
    ['19.7.#',                  { msg: 'Dirt detect sensor error'                                                                                               }],
    ['19.8.#',                  { msg: 'Optical flow sensor error'                                                                                              }],
    ['19.10.#',                 { msg: 'Vacuum fault',                                              opError: 'DustBinFull'                                      }],
    ['19.11.#',                 { msg: 'Illumination ring error'                                                                                                }],
    ['19.12.#',                 { msg: 'Routine maintenance',                                       opError: 'NavigationSensorObscured'                         }],
    ['21.#.#',                  { msg: 'ADC error',                                                 opError: 'NavigationSensorObscured'                         }],
    ['23.0.#',                  { msg: 'Robot lifted',                                              opError: 'Stuck'                                            }],
    [['23.1.#', '23.4.#'],      { msg: 'Robot cannot recover from a drop',                          opError: 'Stuck'                                            }],
    ['23.5.#',                  { msg: 'Rotated - Robot lifted',                                    opError: 'Stuck'                                            }]
];

// Specific faults in Spot+Scrub Ai format
export const DYSON_360_FAULT_SINGLE_CODES = new Map<number, Dyson360FaultDetail>([
    // Dyson Spot+Scrub Ai faults
    // https://support.dyson.com.au/supportHome/Vacuums/Robots/spot-scrub-ai/218087-01/troubleshooting-your-robot/faults-456826
    // and GET /v1/support/product-faults/{serial}?locale=en-GB&market=GB&faultCode={code}
    [  500,                     { msg: 'LiDAR sensor obstructed',                                   opError: 'NavigationSensorObscured'                         }],
    [  501,                     { msg: 'Wheels lifted',                                             opError: 'Stuck'                                            }],
    [  502,                     { msg: 'Battery is low',                                            opError: 'LowBattery'                                       }],
    [  503,                     { msg: "Robot's bin not detected",                                  opError: 'DustBinMissing'                                   }],
    [  504,                     { msg: 'Gyroscopic sensor error',                                   opError: 'NavigationSensorObscured'                         }],
    [  507,                     { msg: 'Unable to determine position',                              opError: 'CannotReachTargetArea'                            }],
    [  508,                     { msg: 'Unable to climb slope',                                     opError: 'Stuck'                                            }],
    [  509,                     { msg: 'Drop sensor obstructed',                                    opError: 'NavigationSensorObscured'                         }],
    [  510,                     { msg: 'Collision sensor obstructed',                               opError: 'NavigationSensorObscured'                         }],
    [  511,                     { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }],
    [  513,                     { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }],
    [  514,                     { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }],
    [  516,                     { msg: 'Battery temperature high',                                  batFault: 'OverTemp',   chargeFault: 'BatteryTooHot'        }],
    [  518,                     { msg: 'Battery is low',                                            opError: 'LowBattery'                                       }],
    [  521,                     { msg: "Dock's clean water tank not detected",                      opError: 'WaterTankMissing'                                 }],
    [  522,                     { msg: 'Wet roller not detected',                                   opError: 'MopCleaningPadMissing'                            }],
    [  560,                     { msg: 'Side sweeper stuck',                                        opError: 'BrushJammed'                                      }],
    [  561,                     { msg: 'Camera obstructed',                                         opError: 'NavigationSensorObscured'                         }],
    [  562,                     { msg: 'Wall follow sensor obstructed',                             opError: 'NavigationSensorObscured'                         }],
    [  563,                     { msg: "Robot's bin not detected",                                  opError: 'DustBinMissing'                                   }],
    [  566,                     { msg: "Robot's dirty water tank not detected",                     opError: 'DirtyWaterTankMissing'                            }],
    [  567,                     { msg: 'Brush bar error',                                           opError: 'BrushJammed'                                      }],
    [  568,                     { msg: 'Left wheel stuck',                                          opError: 'WheelsJammed'                                     }],
    [  569,                     { msg: 'Right wheel stuck',                                         opError: 'WheelsJammed'                                     }],
    [  570,                     { msg: 'Brush bar error',                                           opError: 'BrushJammed'                                      }],
    [  572,                     { msg: 'Robot in avoid area boundary',                              opError: 'CannotReachTargetArea'                            }],
    [  581,                     { msg: "Dock's clean water tank empty",                             opError: 'WaterTankEmpty'                                   }],
    [  582,                     { msg: "Dock's dirty water tank full",                              opError: 'DirtyWaterTankFull'                               }],
    [  583,                     { msg: "Dock's clean water tank not detected",                      opError: 'WaterTankMissing'                                 }],
    [  584,                     { msg: "Dock's dirty water tank not detected",                      opError: 'DirtyWaterTankMissing'                            }],
    [  586,                     { msg: "Robot's dirty water tank full",                             opError: 'DirtyWaterTankFull'                               }],
    [  587,                     { msg: 'Robot cannot communicate with dock'                                                                                     }],
    [  589,                     { msg: 'Unable to determine position',                              opError: 'CannotReachTargetArea'                            }],
    [  591,                     { msg: "Dock's bin full",                                           opError: 'DustBinFull'                                      }],
    [  592,                     { msg: "Dock's filter error"                                                                                                    }],
    [  594,                     { msg: "Unable to empty robot's bin - Bin not attached",            opError: 'DustBinFull'                                      }],
    [  595,                     { msg: "Unable to empty robot's bin - Dock communication error",    opError: 'DustBinFull'                                      }],
    [  596,                     { msg: "Unable to empty robot's bin - Restart robot",               opError: 'DustBinFull'                                      }],
    [  597,                     { msg: "Unable to empty robot's bin - Wait 10 minutes",             opError: 'DustBinFull'                                      }],
    [  611,                     { msg: 'Unable to determine position',                              opError: 'CannotReachTargetArea'                            }],
    [  612,                     { msg: 'Unable to determine position',                              opError: 'CannotReachTargetArea'                            }],
    [  620,                     { msg: "Dock's cleaning solution empty",                            opError: 'WaterTankEmpty'                                   }],
    [  629,                     { msg: 'Wet roller not detected',                                   opError: 'MopCleaningPadMissing'                            }],
    [  630,                     { msg: 'Wet roller stuck',                                          opError: 'BrushJammed'                                      }],
    [  634,                     { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }],
    [  636,                     { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }],
    [  637,                     { msg: "Dock's clean water tank not detected",                      opError: 'WaterTankMissing'                                 }],
    [  639,                     { msg: 'Wet roller not detected',                                   opError: 'MopCleaningPadMissing'                            }],
    [  645,                     { msg: 'Wet roller not detected',                                   opError: 'MopCleaningPadMissing'                            }],
    [  646,                     { msg: 'Wet roller error',                                          opError: 'BrushJammed'                                      }],
    [  650,                     { msg: "Robot's dirty water tank not detected",                     opError: 'DirtyWaterTankMissing'                            }],
    [ 2000,                     { msg: "Dock's bin full",                                           opError: 'DustBinFull'                                      }],
    [ 2003,                     { msg: 'Unable to start scheduled clean - Charge to >20%',          opError: 'LowBattery'                                       }],
    [ 2007,                     { msg: 'Mapping failed',                                            opError: 'CannotReachTargetArea'                            }],
    [ 2012,                     { msg: 'Unable to reach area',                                      opError: 'CannotReachTargetArea'                            }],
    [ 2017,                     { msg: 'Unable to create map',                                      opError: 'CannotReachTargetArea'                            }],
    [ 2119,                     { msg: 'Unable to start scheduled clean - Already cleaning',        opError: 'UnableToStartOrResume'                            }],
    [ 2120,                     { msg: 'Plumbed-in module not detected',                            opError: 'WaterTankMissing'                                 }],
    [ 2121,                     { msg: 'Plumbed-in module water inlet error',                       opError: 'WaterTankEmpty'                                   }],
    [ 2122,                     { msg: 'Plumbed-in module drainage outlet error',                   opError: 'DirtyWaterTankFull'                               }],
    [ 2123,                     { msg: "Dock's clean water pump error"                                                                                          }],
    [ 2124,                     { msg: "Dock's dirty water pump error"                                                                                          }],
    [ 2125,                     { msg: 'Robot not charging',                                        chargeFault: 'Unspecified'                                  }],
    [ 2126,                     { msg: 'Robot not charging',                                        chargeFault: 'Unspecified'                                  }],
    [ 2127,                     { msg: 'Plumbed-in module water supply error',                      opError: 'WaterTankEmpty'                                   }],
    [ 2128,                     { msg: 'Plumbed-in module water inlet error',                       opError: 'WaterTankEmpty'                                   }],
    [ 2131,                     { msg: 'Battery temperature too low',                               batFault: 'UnderTemp',  chargeFault: 'BatteryTooCold'       }],
    [ 2132,                     { msg: 'Battery temperature too high',                              batFault: 'OverTemp',   chargeFault: 'BatteryTooHot'        }],
    [ 2133,                     { msg: 'Battery temperature too low',                               batFault: 'UnderTemp',  chargeFault: 'BatteryTooCold'       }],
    [ 2135,                     { msg: "Dock's cleaning solution tank not detected",                opError: 'WaterTankMissing'                                 }],
    [ 2136,                     { msg: 'Unable to start scheduled clean - Do not disturb',          opError: 'UnableToStartOrResume'                            }],
    [ 2509,                     { msg: 'Robot not level',                                           opError: 'Stuck'                                            }],
    [ 2510,                     { msg: 'Robot picked up',                                           opError: 'Stuck'                                            }],
    [ 2511,                     { msg: 'Robot upside down',                                         opError: 'Stuck'                                            }],
    [ 2515,                     { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }],
    [ 2516,                     { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }],

    // Dyson R2 Nurovi Wash+Dry faults
    // GET /v1/support/product-faults/{serial}?locale=en-GB&market=GB&faultCode={code}
    [ 1002,                     { msg: 'Robot or dock not responding'                                                                                           }],
    [ 1011,                     { msg: 'LiDAR sensor obstructed',                                   opError: 'NavigationSensorObscured'                         }],
    [ 1012,                     { msg: 'Abnormal LiDAR data',                                       opError: 'NavigationSensorObscured'                         }],
    [ 1013,                     { msg: 'LiDAR sensor fault',                                        opError: 'NavigationSensorObscured'                         }],
    [ 1014,                     { msg: 'Line laser sensor obstructed',                              opError: 'NavigationSensorObscured'                         }],
    [ 1015,                     { msg: 'Line laser sensor fault',                                   opError: 'NavigationSensorObscured'                         }],
    [ 1016,                     { msg: 'Collision sensor obstructed',                               opError: 'NavigationSensorObscured'                         }],
    [ 1017,                     { msg: 'LiDAR sensor obstructed',                                   opError: 'NavigationSensorObscured'                         }],
    [ 1021,                     { msg: 'Drop detected',                                             opError: 'Stuck'                                            }],
    [ 1022,                     { msg: 'Drop sensor fault',                                         opError: 'NavigationSensorObscured'                         }],
    [ 1023,                     { msg: 'Drop sensor fault',                                         opError: 'NavigationSensorObscured'                         }],
    [ 1024,                     { msg: 'Drop sensor fault',                                         opError: 'NavigationSensorObscured'                         }],
    [ 1031,                     { msg: 'Unable to start wash',                                      opError: 'UnableToCompleteOperation'                        }],
    [ 1032,                     { msg: 'Floor sensor fault',                                        opError: 'NavigationSensorObscured'                         }],
    [ 1041,                     { msg: 'Caster wheel stuck',                                        opError: 'WheelsJammed'                                     }],
    [ 1044,                     { msg: 'Wheels lifted',                                             opError: 'Stuck'                                            }],
    [ 1045,                     { msg: 'Left wheel stuck',                                          opError: 'Stuck'                                            }],
    [ 1046,                     { msg: 'Right wheel stuck',                                         opError: 'Stuck'                                            }],
    [ 1047,                     { msg: 'Gyroscopic sensor error',                                   opError: 'NavigationSensorObscured'                         }],
    [ 1051,                     { msg: 'Check side sweeper',                                        opError: 'BrushJammed'                                      }],
    [ 1052,                     { msg: 'Side sweeper stuck',                                        opError: 'BrushJammed'                                      }],
    [ 1053,                     { msg: 'Left wet cleaning pad stuck',                               opError: 'BrushJammed'                                      }],
    [ 1054,                     { msg: "Robot's bin not detected",                                  opError: 'DustBinMissing'                                   }],
    [ 1055,                     { msg: "Robot's bin not detected",                                  opError: 'DustBinMissing'                                   }],
    [ 1057,                     { msg: 'Check brush bar lift',                                      opError: 'BrushJammed'                                      }],
    [ 1058,                     { msg: 'Dust detection sensor fault',                               opError: 'NavigationSensorObscured'                         }],
    [ 1061,                     { msg: 'Right wet cleaning pad stuck',                              opError: 'BrushJammed'                                      }],
    [ 1062,                     { msg: 'Right wet cleaning pad stuck',                              opError: 'BrushJammed'                                      }],
    [ 1101,                     { msg: 'Robot vacuum motor fault',                                  opError: 'WheelsJammed'                                     }],
    [ 1102,                     { msg: 'Check brush bar lift',                                      opError: 'BrushJammed'                                      }],
    [ 1103,                     { msg: 'Brush bar lift fault',                                      opError: 'BrushJammed'                                      }],
    [ 1104,                     { msg: 'Brush bar stuck',                                           opError: 'BrushJammed'                                      }],
    [ 1105,                     { msg: 'Brush bar motor fault',                                     opError: 'BrushJammed'                                      }],
    [ 1106,                     { msg: 'Check side sweeper assembly',                               opError: 'BrushJammed'                                      }],
    [ 1107,                     { msg: 'Side sweeper assembly fault',                               opError: 'BrushJammed'                                      }],
    [ 1108,                     { msg: 'Check side sweeper assembly',                               opError: 'BrushJammed'                                      }],
    [ 1109,                     { msg: 'Side sweeper motor fault',                                  opError: 'BrushJammed'                                      }],
    [ 1111,                     { msg: 'Caster wheel stuck',                                        opError: 'WheelsJammed'                                     }],
    [ 1112,                     { msg: 'Caster wheel motor fault',                                  opError: 'WheelsJammed'                                     }],
    [ 1113,                     { msg: 'Left and right wheel lift stuck',                           opError: 'WheelsJammed'                                     }],
    [ 1114,                     { msg: 'Left and right wheel lift motor fault',                     opError: 'WheelsJammed'                                     }],
    [ 1115,                     { msg: 'Right wheel stuck',                                         opError: 'WheelsJammed'                                     }],
    [ 1116,                     { msg: 'Right wheel motor fault',                                   opError: 'WheelsJammed'                                     }],
    [ 1117,                     { msg: 'Left wheel stuck',                                          opError: 'WheelsJammed'                                     }],
    [ 1118,                     { msg: 'Left wheel motor fault',                                    opError: 'WheelsJammed'                                     }],
    [ 1121,                     { msg: 'Robot clean water pump stuck'                                                                                           }],
    [ 1122,                     { msg: 'Robot clean water pump fault'                                                                                           }],
    [ 1123,                     { msg: 'Right wet cleaning pad stuck',                              opError: 'BrushJammed'                                      }],
    [ 1124,                     { msg: 'Right wet cleaning pad motor fault',                        opError: 'BrushJammed'                                      }],
    [ 1125,                     { msg: 'Right wet cleaning pad stuck',                              opError: 'BrushJammed'                                      }],
    [ 1126,                     { msg: 'Right wet cleaning pad swing motor fault',                  opError: 'BrushJammed'                                      }],
    [ 1127,                     { msg: 'Left wet cleaning pad stuck',                               opError: 'BrushJammed'                                      }],
    [ 1128,                     { msg: 'Left wet cleaning pad motor fault',                         opError: 'BrushJammed'                                      }],
    [ 1213,                     { msg: 'Battery temperature out of operating range',                batFault: 'OverTemp',    chargeFault: 'BatteryTooHot'       }],
    [ 1214,                     { msg: 'Battery fault',                                             batFault: 'Unspecified'                                     }],
    [ 1215,                     { msg: 'Battery fault',                                             batFault: 'Unspecified'                                     }],
    [ 1216,                     { msg: 'Battery fault',                                             batFault: 'Unspecified'                                     }],
    [ 3021,                     { msg: 'Robot water tank draining started'                                                                                      }],
    [ 3022,                     { msg: 'Robot water tank draining finished'                                                                                     }],
    [ 3023,                     { msg: 'Clean ended early'                                                                                                      }],
    [ 3222,                     { msg: 'Robot temperature too high',                                batFault: 'OverTemp'                                        }],
    [ 3604,                     { msg: 'Robot not paired to dock'                                                                                               }],
    [ 3701,                     { msg: 'Updating software'                                                                                                      }],
    [ 3702,                     { msg: 'Software update completed'                                                                                              }],
    [ 3703,                     { msg: 'Software update failed'                                                                                                 }],
    [ 3704,                     { msg: 'Unable to update software'                                                                                              }],
    [ 4011,                     { msg: 'Unable to upload map'                                                                                                   }],
    [ 4103,                     { msg: 'Locating failed',                                           opError: 'CannotReachTargetArea'                            }],
    [ 4104,                     { msg: 'Locating failed',                                           opError: 'CannotReachTargetArea'                            }],
    [ 4105,                     { msg: 'Mapping failed',                                            opError: 'CannotReachTargetArea'                            }],
    [ 4201,                     { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }],
    [ 4202,                     { msg: 'Drop sensor obstructed',                                    opError: 'NavigationSensorObscured'                         }],
    [ 4203,                     { msg: 'Drop detected',                                             opError: 'Stuck'                                            }],
    [ 4204,                     { msg: 'Unable to climb slope',                                     opError: 'Stuck'                                            }],
    [ 4205,                     { msg: 'Robot in restricted area',                                  opError: 'CannotReachTargetArea'                            }],
    [ 4206,                     { msg: 'Unable to reach area',                                      opError: 'CannotReachTargetArea'                            }],
    [ 5003,                     { msg: 'Unable to find starting point',                             opError: 'CannotReachTargetArea'                            }],
    [ 5005,                     { msg: 'Unable to return to charge',                                opError: 'FailedToFindChargingDock'                         }],
    [ 5006,                     { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }],
    [ 5007,                     { msg: 'Robot at starting point'                                                                                                }],
    [ 5022,                     { msg: 'Battery unrecognised',                                      batFault: 'Unspecified', chargeFault: 'BatteryAbsent'       }],
    [ 5023,                     { msg: 'Robot powering off',                                        batFault: 'Unspecified', opError: 'LowBattery'              }],
    [ 5025,                     { msg: 'Robot battery fault',                                       batFault: 'Unspecified'                                     }],
    [ 5027,                     { msg: 'Robot battery fault',                                       batFault: 'Unspecified'                                     }],
    [ 6202,                     { msg: 'Unable to start scheduled clean',                           opError: 'UnableToStartOrResume'                            }],
    [ 6203,                     { msg: 'Unable to start scheduled clean',                           opError: 'UnableToStartOrResume'                            }],
    [ 6204,                     { msg: 'Unable to start scheduled clean',                           opError: 'UnableToStartOrResume'                            }],
    [ 6205,                     { msg: 'Unable to start scheduled clean',                           opError: 'UnableToStartOrResume'                            }],
    [ 7002,                     { msg: "Unable to empty robot's bin",                               opError: 'DustBinFull'                                      }],
    [ 7007,                     { msg: "Unable to clean robot's wet cleaning pads",                 opError: 'UnableToCompleteOperation'                        }],
    [ 7008,                     { msg: 'Robot not on dock',                                         opError: 'FailedToFindChargingDock'                         }],
    [ 8111,                     { msg: "Time to maintain dock's bin",                               opError: 'DustBinFull'                                      }],
    [22001,                     { msg: "Dock's bin not detected",                                   opError: 'DustBinMissing'                                   }],
    [22002,                     { msg: "Dock's bin not detected",                                   opError: 'DustBinMissing'                                   }],
    [22004,                     { msg: "Dock's drying system fault"                                                                                             }],
    [22005,                     { msg: "Dock's drying system temperature too high"                                                                              }],
    [22011,                     { msg: "Dock's clean water tank not detected",                      opError: 'WaterTankMissing'                                 }],
    [22012,                     { msg: "Dock's clean water tank not detected",                      opError: 'WaterTankMissing'                                 }],
    [22014,                     { msg: "Dock's dirty water tank not detected",                      opError: 'DirtyWaterTankMissing'                            }],
    [22015,                     { msg: "Dock's dirty water tank not detected",                      opError: 'DirtyWaterTankMissing'                            }],
    [22021,                     { msg: "Dock's cleaning tray not detected"                                                                                      }],
    [22023,                     { msg: 'Turbidity sensor fault',                                    opError: 'NavigationSensorObscured'                         }],
    [22024,                     { msg: 'Sewage drainage fault',                                     opError: 'DirtyWaterTankFull'                               }],
    [22025,                     { msg: "Dock's cleaning tray not detected"                                                                                      }],
    [22026,                     { msg: "Dock's clean water tank empty",                             opError: 'WaterTankEmpty'                                   }],
    [22027,                     { msg: "Dock's dirty water tank full",                              opError: 'DirtyWaterTankFull'                               }],
    [22101,                     { msg: "Dock's clean water pump fault"                                                                                          }],
    [22102,                     { msg: "Dock's clean water pump fault"                                                                                          }],
    [22103,                     { msg: "Dock's three-way valve fault"                                                                                           }],
    [22104,                     { msg: "Dock's three-way valve fault"                                                                                           }],
    [22105,                     { msg: "Dock's dirty water pump fault"                                                                                          }],
    [22106,                     { msg: "Dock's dirty water pump fault"                                                                                          }],
    [22111,                     { msg: "Dock's drying fan fault"                                                                                                }],
    [22112,                     { msg: "Dock's drying fan fault"                                                                                                }],

    // Fault codes that appear to exist but are not documented by Dyson:
    //      Spot+Scrub Ai:      502, 517-518, 525, 527-536, 540-542, 550-551, 559, 563-565, 567, 571, 573-574, 580, 585, 588, 590, 601-605, 613-619, 621-628, 636, 638, 640-646, 700-701, 711-713, 2001-2002, 2004-2006, 2008-2011, 2013-2015, 2018-2020, 2100-2112, and 2114-2118
    //      R2 Nurovi Wash+Dry: 1001, 1003-1004, 1056, 3001-3003, 3011-3013, 3101-3102, 3111-3112, 3121-3198, 3201-3206, 3211-3214, 3221, 3301-3304, 3402-3406, 3501-3502, 3601-3603, 3705, 3801-3802, 3901-3903, 3911-3917, 4001-4009, 4101-4102, 5001-5002, 5004, 5008-5009, 5011-5019, 5021, 5024, 5026, 6003, 6011-6013, 6021-6023, 6031-6034, 6041, 6044, 6101-6103, 6201, 7001, 7003-7006, 7011-7012, 8001-8004, 8011-8018, 8101-8104, 8112, 22003, 22013, 22016, and 22022

    // Karcher RCV 5 fault codes (excluding duplicates of above)
    // https://github.com/vosadci/karcher-rcv5-ha/blob/main/doc/PROTOCOL.md
    [  100,                     { msg: 'Hardware driver error'                                                                                                  }], // FAULT_HWDRIVER
    // [  500,                  { msg: 'LiDAR sensor obstructed',                                   opError: 'NavigationSensorObscured'                         }], // FAULT_LIDAR_TIME_OUT
    // [  501,                  { msg: 'Wheels lifted',                                             opError: 'Stuck'                                            }], // FAULT_WHEEL_UP
    // [  502,                  { msg: 'Battery is low',                                            opError: 'LowBattery'                                       }], // FAULT_LOW_START_BATTERY
    // [  503,                  { msg: "Robot's bin not detected",                                  opError: 'DustBinMissing'                                   }], // FAULT_DUSTBOX_NOT_EXIST
    // [  504,                  { msg: 'Gyroscopic sensor error',                                   opError: 'NavigationSensorObscured'                         }], // FAULT_GEOMAGETISM_STRUCT
    [  505,                     { msg: 'Unable to start from dock',                                 opError: 'UnableToStartOrResume'                            }], // FAULT_START_DOCK_FAILED
    [  506,                     { msg: 'Follow IR sensor exception',                                opError: 'NavigationSensorObscured'                         }], // FAULT_FOLLOWE_IR_EXCEPTION
    // [  507,                  { msg: 'Unable to determine position',                              opError: 'CannotReachTargetArea'                            }], // FAULT_RELOCALIZATION_FAILED
    // [  508,                  { msg: 'Unable to climb slope',                                     opError: 'Stuck'                                            }], // FAULT_SLOPE_START_FAILED
    // [  509,                  { msg: 'Drop sensor obstructed',                                    opError: 'NavigationSensorObscured'                         }], // FAULT_CLIFF_IR_STRUCT
    // [  510,                  { msg: 'Collision sensor obstructed',                               opError: 'NavigationSensorObscured'                         }], // FAULT_BUMPER_STRUCT
    // [  511,                  { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }], // FAULT_GO_DOCK_FAILED
    [  512,                     { msg: 'Place robot on dock',                                       opError: 'FailedToFindChargingDock'                         }], // FAULT_PUT_MACHINE_DOCK
    // [  513,                  { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }], // FAULT_NAVIGATION_FAILED
    // [  514,                  { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }], // FAULT_ESCAPE_FAILED
    [  515,                     { msg: 'Dock clip exception',                                       opError: 'FailedToFindChargingDock'                         }], // FAULT_DOCK_CLIP_EXCEPTION
    // [  516,                  { msg: 'Battery temperature high',                                  batFault: 'OverTemp',   chargeFault: 'BatteryTooHot'        }], // FAULT_BATTERY_TEMPATURE
    [  517,                     { msg: 'System upgrading',                                          opError: 'CommandInvalidInState'                            }], // FAULT_SYSTEM_UPGRADE
    [  518,                     { msg: 'Battery is low',                                            opError: 'LowBattery'                                       }], // FAULT_WAIT_CHARGE_FINISH
    [  519,                     { msg: 'Main brush stalled',                                        opError: 'BrushJammed'                                      }], // FAULT_ROLL_BRUSH_STALL
    [  520,                     { msg: 'Side brush stalled',                                        opError: 'BrushJammed'                                      }], // FAULT_SIDE_BRUSH_STALL
    // [  521,                  { msg: "Dock's clean water tank not detected",                      opError: 'WaterTankMissing'                                 }], // FAULT_WATER_BOX_NOT_EXIST
    // [  522,                  { msg: 'Wet roller not detected',                                   opError: 'MopCleaningPadMissing'                            }], // FAULT_MOPPING_NOT_EXIST
    [  523,                     { msg: 'Bin full',                                                  opError: 'DustBinFull'                                      }], // FAULT_HANDPPEN_DUST_BOX_FULL
    [  524,                     { msg: 'Power switch not on',                                       chargeFault: 'Unspecified'                                  }], // FAULT_POWER_SWITCH_NOT_OPEN
    [  525,                     { msg: 'Water tank empty',                                          opError: 'WaterTankEmpty'                                   }], // FAULT_WATER_TRUNK_EMPTY
    [  526,                     { msg: 'Mop cloth dirty',                                           opError: 'MopCleaningPadMissing'                            }], // FAULT_DISHCLOTH_DIRTY
    [  527,                     { msg: 'Bin full',                                                  opError: 'DustBinFull'                                      }], // FAULT_FAULT_DUST_BOX_FULL
    [  530,                     { msg: 'Battery temperature too high',                              batFault: 'OverTemp',   chargeFault: 'BatteryTooHot'        }], // FAULT_BATTERY_TEMPERATURE_ABNORMAL
    [  531,                     { msg: 'Battery temperature returned to normal',                                                           statusOnly: true     }], // FAULT_BATTERY_TEMPERATURE_NORMAL
    // [ 2000,                  { msg: "Dock's bin full",                                           opError: 'DustBinFull'                                      }], // FAULT_DUSBOX_FULL
    [ 2001,                     { msg: 'Left brush blocked',                                        opError: 'BrushJammed'                                      }], // FAULT_BRUSH_LEFT_BLOCK
    [ 2002,                     { msg: 'Right brush blocked',                                       opError: 'BrushJammed'                                      }], // FAULT_BRUSH_RIGHT_BLOCK
    // [ 2003,                  { msg: 'Unable to start scheduled clean - Charge to >20%',          opError: 'LowBattery'                                       }], // FAULT_NO_POWER_PLAN_DIS
    // [ 2007,                  { msg: 'Mapping failed',                                            opError: 'CannotReachTargetArea'                            }], // FAULT_BROKEN_CLEANING
    [ 2008,                     { msg: 'Cleaning complete',                                                                                 statusOnly: true    }], // FAULT_CLEAN_COMPLETE
    [ 2009,                     { msg: 'Scheduled clean complete',                                                                          statusOnly: true    }], // FAULT_PLAN_CLEAN_COMPLETE
    [ 2010,                     { msg: 'ToF sensor abnormal',                                       opError: 'NavigationSensorObscured'                         }], // FAULT_TOF_ABNORMAL
    [ 2100,                     { msg: 'Return-to-dock interrupted',                                opError: 'FailedToFindChargingDock'                         }], // FAULT_BROKEN_GO_HOME
    [ 2101,                     { msg: 'Charging interrupted',                                      opError: 'LowBattery'                                       }], // FAULT_BROKEN_CHARGING
    [ 2102,                     { msg: 'Returning to dock...',                                                                              statusOnly: true    }], // FAULT_ROBOT_GLOBAL_GO_HOME
    [ 2103,                     { msg: 'Charging...',                                                                                       statusOnly: true    }], // FAULT_ROBOT_CHARGING
    [ 2104,                     { msg: 'Returning to dock (user-initiated)...',                                                             statusOnly: true    }], // FAULT_ROBOT_USER_GO_HOME
    [ 2105,                     { msg: 'Charging complete',                                                                                 statusOnly: true    }], // FAULT_ROBOT_CHARGE_FINISH
    [ 2106,                     { msg: 'Charging-wait interrupted',                                                                         statusOnly: true    }], // FAULT_BROKEN_CHARGING_WAIT
    [ 2107,                     { msg: 'Scheduled clean in progress...',                                                                    statusOnly: true    }], // FAULT_GLOBAL_APPOINT_CLEAN
    [ 2108,                     { msg: 'Finding position on map...',                                                                        statusOnly: true    }], // FAULT_ROBOT_RELOCALITION_ING
    [ 2109,                     { msg: 'Repeat cleaning in progress...',                                                                    statusOnly: true    }], // FAULT_ROBOT_REPEAT_CLEAN_ING
    [ 2110,                     { msg: 'Performing self-test...',                                                                           statusOnly: true    }], // FAULT_ROBOT_SELF_CHECK_ING
    [ 4002,                     { msg: 'Map error',                                                 opError: 'UnableToCompleteOperation'                        }]  // FAULT_MAP_ERROR
]);