// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2026 Alexander Thoukydides

import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { Dyson360Faults, Dyson360State } from './dyson-360-types.js';

/* eslint-disable max-len */

// Mapping of a single fault to RVC Operational State and Power Source clusters
export interface Dyson360FaultDetail {
    msg:            string;
    opError?:       keyof typeof RvcOperationalState.ErrorState;
    batFault?:      keyof typeof PowerSource.BatFault;
    chargeFault?:   keyof typeof PowerSource.BatChargeFault;
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
    BRUSH_BAR_AND_TRACTION:     { msg: 'Robot stuck',               /* Lights: 2 red */             opError: 'Stuck'                                            },
    CHARGE_STATION:             { msg: 'Unable to return to dock',  /* Lights: 3 red */             opError: 'FailedToFindChargingDock'                         },
    OPTICS:                     { msg: 'Optical sensors fault'      /* Lights: 4 red */                                                                         },
    LIFT:                       { msg: 'Robot lifted',                                              opError: 'Stuck'                                            },
    LOST:                       { msg: 'Navigation fault',          /* Lights: Red battery */       opError: 'UnableToCompleteOperation'                        },
    BATTERY:                    { msg: 'Battery fault',                                             batFault: 'Unspecified', chargeFault: 'Unspecified'         }
};

// Specific faults/ranges
export const DYSON_360_FAULT_CODES: [Dyson360FaultPatternOrRange, Dyson360FaultDetail][] = [
    // Dyson 360 Eye faults (observed)
    ['1.0.-1',                  { msg: 'Bin full or airways blocked',                               opError: 'DustBinFull'                                      }],
    ['3.5.-1',                  { msg: 'Brush bar or tracks stuck',                                 opError: 'Stuck'                                            }],
    ['7.0.-1',                  { msg: 'Bin missing or not detected',                               opError: 'DustBinMissing'                                   }],
    ['9.0.-1',                  { msg: 'Unable to return to dock',                                  opError: 'FailedToFindChargingDock'                         }],

    // Dyson 360 Vis Nav fault
    // https://support.dyson.com.au/supportHome/Vacuums/Robots/360visnav/304640-01/using-your-robot/fault-codes
    ['1.0.#',                   { msg: 'Airways blocked',                                           opError: 'DustBinFull'                                      }],
    ['1.2.#',                   { msg: 'Check bin level',                                           opError: 'DustBinFull'                                      }],
    ['1.4.#',                   { msg: 'Vacuum calibration missing'                                                                                             }],
    [['1.5.#', '1.6.#'],        { msg: 'Filter not detected',                                       opError: 'DustBinMissing'                                   }],
    [['1.7.#', '1.8.#'],        { msg: 'Check airways',                                             opError: 'DustBinFull'                                      }],
    ['3.3.#',                   { msg: 'Brush bar motor too hot',                                   batFault: 'OverTemp'                                        }],
    ['3.4.#',                   { msg: 'Wheel motor too hot',                                       batFault: 'OverTemp'                                        }],
    ['3.5.#',                   { msg: 'Brush bar stuck',                                           opError: 'Stuck'                                            }],
    ['3.6.#',                   { msg: 'Wheel stuck',                                               opError: 'Stuck'                                            }],
    [['3.7.#', '3.8.#'],        { msg: 'Wheel hardware failure',                                    opError: 'Stuck'                                            }],
    ['3.9.#',                   { msg: 'Robot stuck',                                               opError: 'Stuck'                                            }],
    [['3.10.#', '3.15.#'],      { msg: 'ADC error'                                                                                                              }],
    ['3.16.#',                  { msg: 'Brush bar stuck',                                           opError: 'Stuck'                                            }],
    ['3.16.12',                 { msg: 'Brush bar motor too hot',                                   batFault: 'OverTemp'                                        }],
    ['3.16.13',                 { msg: 'Brush bar motor too cold',                                  batFault: 'UnderTemp'                                       }],
    ['3.16.16',                 { msg: 'Brush bar motor winding failure'                                                                                        }],
    ['3.16.30',                 { msg: 'Brush bar communication failure'                                                                                        }],
    ['3.16.33',                 { msg: 'Brush bar communication failure'                                                                                        }],
    ['3.17.#',                  { msg: 'Wheel stuck',                                               opError: 'Stuck'                                            }],
    ['3.19.#',                  { msg: 'Wheel stuck',                                               opError: 'Stuck'                                            }],
    [['3.20.#', '3.21.#'],      { msg: 'Edge actuator stuck',                                       opError: 'Stuck'                                            }],
    ['3.22.#',                  { msg: 'Edge actuator switch stuck',                                opError: 'Stuck'                                            }],
    ['3.23.#',                  { msg: 'Brush bar stuck',                                           opError: 'Stuck'                                            }],
    ['3.23.12',                 { msg: 'Brush bar motor too hot',                                   batFault: 'OverTemp'                                        }],
    ['3.23.13',                 { msg: 'Brush bar motor too cold',                                  batFault: 'UnderTemp'                                       }],
    ['3.23.16',                 { msg: 'Brush bar motor winding failure'                                                                                        }],
    ['3.23.30',                 { msg: 'Brush bar communication failure'                                                                                        }],
    ['3.23.33',                 { msg: 'Brush bar communication failure'                                                                                        }],
    [['3.100.#', '3.112.#'],    { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['3.113.#',                 { msg: 'Left wheel - Wheel motor too cold',                         batFault: 'UnderTemp'                                       }],
    [['3.114.#', '3.115.#'],    { msg: 'Left wheel - Wheel motor too hot',                          batFault: 'OverTemp'                                        }],
    [['3.116.#', '3.120.#'],    { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['3.121.#',                 { msg: 'Right wheel - Wheel motor too cold',                        batFault: 'UnderTemp'                                       }],
    [['3.122.#', '3.123.#'],    { msg: 'Right wheel - Wheel motor too hot',                         batFault: 'OverTemp'                                        }],
    [['3.124.#', '3.128.#'],    { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['3.129.#',                 { msg: 'Brush bar motor too cold',                                  batFault: 'UnderTemp'                                       }],
    [['3.130.#', '3.131.#'],    { msg: 'Brush bar motor too hot',                                   batFault: 'OverTemp'                                        }],
    [['5.0.#', '5.2.#'],        { msg: 'Battery pack - ADC error',                                  batFault: 'Unspecified', chargeFault: 'Unspecified'         }],
    ['5.3.#',                   { msg: 'Battery locked out',                                        batFault: 'Unspecified', chargeFault: 'SafetyTimeout'       }],
    ['5.4.#',                   { msg: 'Battery disconnected',                                      batFault: 'Unspecified', chargeFault: 'BatteryAbsent'       }],
    ['5.5.#',                   { msg: 'Battery low voltage',                                       batFault: 'Unspecified', chargeFault: 'BatteryUnderVoltage' }],
    ['5.6.#',                   { msg: 'Battery charge required',                                   batFault: 'Unspecified'                                     }],
    [['5.7.#', '5.9.#'],        { msg: 'Battery too hot',                                           batFault: 'OverTemp',    chargeFault: 'BatteryTooHot'       }],
    ['5.10.#',                  { msg: 'Unable to shut down'                                                                                                    }],
    ['7.#.#',                   { msg: 'Bin not detected',                                          opError: 'DustBinMissing'                                   }],
    ['9.#.#',                   { msg: 'Unable to dock',                                            opError: 'FailedToFindChargingDock'                         }],
    [['11.0.#', '11.1.#'],      { msg: 'Distance sensor calibration error'                                                                                      }],
    ['11.2.#',                  { msg: 'ADC error'                                                                                                              }],
    ['11.3.#',                  { msg: 'Distance sensor error'                                                                                                  }],
    ['11.5.#',                  { msg: 'Camera calibration error'                                                                                               }],
    ['11.6.#',                  { msg: 'Camera unplugged'                                                                                                       }],
    ['11.7.#',                  { msg: 'Distance sensor error'                                                                                                  }],
    ['11.8.#',                  { msg: 'Distance sensor calibration error'                                                                                      }],
    ['11.9.#',                  { msg: 'Distance sensor calibration error'                                                                                      }],
    ['11.10.#',                 { msg: 'Drop detected at start of clean',                          opError: 'UnableToStartOrResume'                             }],
    [['11.11.#', '11.14.#'],    { msg: 'ADC error'                                                                                                              }],
    ['11.15.#',                 { msg: 'Unclean distance sensor'                                                                                                }],
    ['11.16.#',                 { msg: 'Distance sensor error'                                                                                                  }],
    ['11.17.#',                 { msg: 'Distance sensor communication error'                                                                                    }],
    ['11.18.#',                 { msg: 'Distance sensor calibration error'                                                                                      }],
    ['11.19.#',                 { msg: 'Drop sensor maintenance alert'                                                                                          }],
    ['11.20.#',                 { msg: 'Non-drop sensor maintenance alert'                                                                                      }],
    ['11.21.#',                 { msg: 'Distance sensor error'                                                                                                  }],
    ['11.22.#',                 { msg: 'Unclean distance sensor'                                                                                                }],
    [['13.0.-1', '13.0.1'],     { msg: 'Dirty obstacle sensors - Cannot find a route back to dock', opError: 'FailedToFindChargingDock'                         }],
    [['13.1.#', '13.2.#'],      { msg: 'Navigation sensor error'                                                                                                }],
    ['13.3.-1',                 { msg: 'Low battery',                                               opError: 'UnableToCompleteOperation'                        }],
    ['13.3.1',                  { msg: 'Dirty obstacle sensors - Low battery',                      opError: 'UnableToCompleteOperation'                        }],
    ['13.4.#',                  { msg: 'Low battery at clean start',                                opError: 'UnableToStartOrResume'                            }],
    ['13.5.#',                  { msg: 'Camera exposure not settled'                                                                                            }],
    [['13.6.#', '13.7.#'],      { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['13.8.#',                  { msg: 'Failed to set state'                                                                                                    }],
    ['13.9.#',                  { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['13.10.#',                 { msg: 'Insufficient features to find location',                    opError: 'UnableToCompleteOperation'                        }],
    ['13.12.#',                 { msg: 'High uncertainty in discovery',                             opError: 'UnableToCompleteOperation'                        }],
    ['13.13.#',                 { msg: 'Persistent location lost',                                  opError: 'UnableToCompleteOperation'                        }],
    ['13.14.#',                 { msg: 'Discovered wrong floor',                                    opError: 'UnableToCompleteOperation'                        }],
    ['13.15.#',                 { msg: 'Persistent location jump',                                  opError: 'UnableToCompleteOperation'                        }],
    ['13.16.#',                 { msg: 'Software error'                                                                                                         }],
    ['13.17.#',                 { msg: 'Replacement fault'                                                                                                      }],
    ['13.18.#',                 { msg: 'Low battery',                                               opError: 'FailedToFindChargingDock'                         }],
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
    ['17.12.#',                 { msg: 'Edge actuator - Brush bar motor too hot',                   batFault: 'OverTemp'                                        }],
    ['17.13.#',                 { msg: 'Could not start LCD screen'                                                                                             }],
    ['17.14.#',                 { msg: 'Low level PCB communication error'                                                                                      }],
    ['17.15.#',                 { msg: 'Wheel stuck',                                               opError: 'Stuck'                                            }],
    ['17.16.#',                 { msg: 'Failed to upgrade'                                                                                                      }],
    ['17.17.#',                 { msg: 'Low memory'                                                                                                             }],
    ['17.18.#',                 { msg: 'Failed to save map'                                                                                                     }],
    ['17.19.#',                 { msg: 'Unable to start',                                           opError: 'UnableToStartOrResume'                            }],
    ['17.20.#',                 { msg: 'Unable to upload robot logs'                                                                                            }],
    ['17.21.#',                 { msg: 'DHCP - Software error'                                                                                                  }],
    ['17.22.#',                 { msg: 'IMU data error'                                                                                                         }],
    ['17.23.#',                 { msg: 'Zoned map error'                                                                                                        }],
    [['17.100.#', '17.703.#'],  { msg: 'Unhandled alert'                                                                                                        }],
    [['19.0.#', '19.2.#'],      { msg: 'Robot too hot',                                             batFault: 'OverTemp'                                        }],
    ['19.3.#',                  { msg: 'Safety prevents motion',                                    opError: 'Stuck'                                            }],
    ['19.4.#',                  { msg: 'ADC error'                                                                                                              }],
    ['19.5.#',                  { msg: 'Wheel motor too hot',                                       batFault: 'OverTemp'                                        }],
    ['19.6.#',                  { msg: 'Charge contact too hot',                                    chargeFault: 'AmbientTooHot'                                }],
    ['19.7.#',                  { msg: 'Dirt detect sensor error'                                                                                               }],
    ['19.8.#',                  { msg: 'Optical flow sensor error'                                                                                              }],
    ['19.10.#',                 { msg: 'Vacuum fault',                                              opError: 'DustBinFull'                                      }],
    ['19.11.#',                 { msg: 'Illumination ring error'                                                                                                }],
    ['19.12.#',                 { msg: 'Routine maintenance'                                                                                                    }],
    ['21.#.#',                  { msg: 'ADC error'                                                                                                              }],
    ['23.0.#',                  { msg: 'Robot lifted',                                              opError: 'Stuck'                                            }],
    [['23.1.#', '23.4.#'],      { msg: 'Robot cannot recover from a drop',                          opError: 'Stuck'                                            }],
    ['23.5.#',                  { msg: 'Rotated - Robot lifted',                                    opError: 'Stuck'                                            }]
];