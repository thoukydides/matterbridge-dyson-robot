// Matterbridge plugin for Dyson robot vacuum and air treatment devices
// Copyright © 2025 Alexander Thoukydides

import { db, nf, YELLOW } from 'matterbridge/logger';
import { InspectOptions } from 'util';

// Log colours
export const RI = `\u001B[39;49m${nf}`; // Reset to info text (light grey)
export const RD = `\u001B[39;49m${db}`; // Reset to debug text (dark grey)
export const DT = '\u001B[38;5;67m';    // Raw description (dim blue)
export const DV = '\u001B[38;5;75m';    // Raw value (dim cyan)
export const AN = '\u001B[38;5;87m';    // Attribute or event names (bright cyan)
export const AV = YELLOW;               // Attribute or event values
export const CN = '\u001B[38;5;120m';   // Command cluster (bright green)
export const CV = YELLOW;               // Command name/value
export const CC = '\u001B[30;43m';      // Appliance command (yellow background)
export const MP = '\u001B[37;48;5;92m'; // MQTT publish (purple background)
export const MR = '\u001B[38;5;92m';    // MQTT receive (dim purple)
export const MM = RI;                   // MQTT payload (light grey)
export const ST = '\u001B[9m';          // Strikethrough
export const SR = '\u001B[29m';         // Reset strikethrough

// Single-line inspection format
export const INSPECT_SINGLE_LINE: InspectOptions = {
    colors:             true,
    depth:              Infinity,
    maxArrayLength:     Infinity,
    maxStringLength:    100,
    breakLength:        Infinity,
    compact:            true,
    sorted:             true,
    numericSeparator:   false
};

// Verbose inspection format
export const INSPECT_VERBOSE: InspectOptions = {
    colors:             true,
    depth:              Infinity,
    maxArrayLength:     Infinity,
    maxStringLength:    Infinity,
    breakLength:        80,
    compact:            3,
    sorted:             true,
    numericSeparator:   true
};