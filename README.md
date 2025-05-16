<p align="center">
  <img src="https://raw.githubusercontent.com/wiki/thoukydides/matterbridge-dyson-robot/matterbridge-dyson-robot.png" height="200">
</p>
<div align=center>

# matterbridge-dyson-robot

[![npm](https://badgen.net/npm/v/matterbridge-dyson-robot)](https://www.npmjs.com/package/matterbridge-dyson-robot)
[![npm](https://badgen.net/npm/dt/matterbridge-dyson-robot)](https://www.npmjs.com/package/matterbridge-dyson-robot)
[![npm](https://badgen.net/npm/dw/matterbridge-dyson-robot)](https://www.npmjs.com/package/matterbridge-dyson-robot)
[![Build and Lint](https://github.com/thoukydides/matterbridge-dyson-robot/actions/workflows/build.yml/badge.svg)](https://github.com/thoukydides/matterbridge-dyson-robot/actions/workflows/build.yml)

A [Matterbridge](https://github.com/Luligu/matterbridge) plugin that connects [Dyson](https://www.dyson.co.uk/) robot vacuums and air treatment devices  
to the [Matter](https://csa-iot.org/all-solutions/matter/) smart home ecosystem via their local MQTT APIs.

</div>

Dyson, Dyson Cool, Dyson Hot, Dyson Hot+Cool, Dyson Pure, Dyson Pure Cool, Dyson Pure Cool Link, Dyson Pure Hot+Cool Link, Dyson Pure Humidify+Cool, Dyson 360 Eye, Dyson 360 Heurist, and Dyson 360 Vis Nav, are trademarks of [Dyson Technology Limited](https://www.dyson.co.uk/).

## Installation

### Step 1 - Create Account and Connect Devices
1. Use the MyDyson [iPhone](https://apps.apple.com/gb/app/mydyson/id993135524) or [Android](https://play.google.com/store/apps/details?id=com.dyson.mobile.android) app to create an account.
1. Add the Dyson robot vacuum cleaner and/or air treatment devices to your Dyson account.

### Step 2 - Obtain Device MQTT Credentials

#### Option 1: Using Wi-Fi Setup Label

1. For each device find the label with the Wi-Fi setup credentials. This may be located:
   1. behind the clean bin of robot vacuums,
   1. underneath the base of air treatment devices, or
   1. attached to the operating manual.
1. Note the **Product SSID** (`wifi_ssid`) and the **Product Wi-Fi Password** (`wifi_password`). These are case-sensitive and must be entered exactly as shown on the label.

#### Option 2: Using `opendyson` <!-- (enables either local or cloud connection) -->

1. Install [opendyson](https://github.com/libdyson-wg/opendyson), e.g. if `Go` is installed and configured:  
   `go install github.com/libdyson-wg/opendyson`
1. Login to your MyDyson account:  
   `opendyson login`
1. Identify devices and retrieve their connection credentials:  
   `opendyson devices`
1. For each device note the `mqtt` values: `username`, `password`, and `root_topic`

### Step 3 - Matterbridge Plugin Installation

#### Recommended Approach using Matterbridge Frontend

1. Open the Matterbridge web interface, e.g. at http://localhost:8283/.
1. Under *Install plugins* type `matterbridge-dyson-robot` in the *Plugin name or plugin path* search box, then click *Install ⬇️*.
1. Click *🔄 Restart Matterbridge* to apply the change.
1. Open the **matterbridge-dyson-robot** *⚙️ Plugin config* and configure details of each robot vacuum or air treatment device:
   1. `name`: A friendly name (that will be used as the Matter **NodeLabel**) for the device.
   1. Select the type of MQTT credentials (from step 2) and enter the required details, either:
      1. **Wi-Fi Setup Configuration**  
         `host`: The hostname or IP address of the device on your local network.  
         `wifi_ssid` and `wifi_password`: The values from the product's Wi-Fi setup label.
      1. **Local MQTT Configuration**  
         `host`: The hostname or IP address of the device on your local network.  
         `username`, `password`, and `root_topic`: The values listed by `opendyson`.
1. Use ➕ to add additional devices, and enter their details.
1. Click *CONFIRM* to save the plugin configuration and restart Matterbridge again.

<details>
<summary>Alternative method using command line (and advanced configuration)</summary>

#### Installation using Command Line

1. Stop Matterbridge:  
   `systemctl stop matterbridge`
1. Install the plugin:  
   `npm install -g matterbridge-dyson-robot`
1. Register it with Matterbridge:  
   `matterbridge -add matterbridge-dyson-robot`
1. Restart Matterbridge:  
   `systemctl start matterbridge`

#### Example `matterbridge-dyson-robot.config.json`

Local network connection configured using credentials from Wi-Fi setup label:
```JSON
{
    "devices": [{
        "name":                   "Katniss Everclean",
        "host":                   "dyson-360eye.local",
        "port":                   1883,
        "wifi_ssid":              "360EYE-AA1-UK-BBB2222B",
        "wifi_password":          "abcdefgh"
    }]
}
```

Local network connection configured using MQTT credentials (obtained using `opendyson`):
```JSON
{
    "devices": [{
        "name":                   "Katniss Everclean",
        "host":                   "192.168.0.100",
        "port":                   1883,
        "username":               "AA1-UK-BBB2222B",
        "password":               "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNOPQRSTUV==",
        "root_topic":             "N223"
    }]
}
```

#### Advanced Configuration

You can include additional settings in `matterbridge-dyson-robot.config.json` to customise the behaviour or enable special debug features:
```JSON
{
    "name":                 "matterbridge-dyson-robot",
    "type":                 "DynamicPlatform",
    "version":              "1.0.0",
    "whiteList":            [],
    "blackList":            ["360EYE-AA1-UK-BBB2222B"],
    "entityWhiteList":      [],
    "entityBlackList":      ["Composed Air Purifier", "Humidity Sensor", "Temperature Sensor"],
    "deviceEntityBlackList": {
        "CC3-UK-DDD4444D":       ["Air Purifier"],
    },
    "devices": [{
        "name":                   "Obi-Wan Cleanobi",
        "host":                   "dyson-360eye.local",
        "port":                   1883,
        "wifi_ssid":              "360EYE-AA1-UK-BBB2222B",
        "wifi_password":          "abcdefgh"
    }, {
        "name":                   "Hoth Breeze",
        "host":                   "192.168.0.100",
        "port":                   1883,
        "username":               "CC3-UK-DDD4444D",
        "password":               "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNOPQRSTUV==",
        "root_topic":             "475"
    }],
    "wildcardTopic":        true,
    "composedDevices":      false,
    "debug":                false,
    "debugFeatures":        ["Log Endpoint Debug", "Log MQTT Client", "Log MQTT Payloads", "Log Serial Numbers", "Log Debug as Info"],
    "unregisterOnShutdown": false
}
```

| Key                     | Default | Description
| ----------------------- | ------- | ---
| `name`<br>`type`<br>`version` | n/a | These are managed by Matterbridge and do not need to be set manually.
| `devices[]`             | `[]`    | MQTT configuration for each Dyson device. See *Step 2 - Obtain Device MQTT Credentials* (above).
| `wildcardTopic`         | `true`  | When set to `true` the plugin subscribes to the wildcard (`#`) MQTT topic, receiving every message published or echoed by the robot vacuum and air treatment devices. This is useful for discovering new topics, seeing the commands issued by the MyDyson app to air treatment devices (but not to robot vacuums), and verifying correct `root_topic` and `username` settings.
| `blackList`             | `[]`    | If the list is not empty, then any robot vacuum and air treatment devices with matching serial numbers will not be exposed as Matter devices.
| `whiteList`             | `[]`    | If the list is not empty, then only robot vacuum and air treatment devices with matching serial numbers (and not on the `blacklist`) will be exposed as Matter devices.
| `entityBlackList`       | `["Composed Air Purifier", "Humidity Sensor", "Temperature Sensor"]` | If the list is not empty, then any endpoint device types listed will be excluded. This applies to all air treatment devices. It does not affect robot vacuum devices.
| `entityWhiteList`       | `[]`    | If the list is not empty, then only endpoint device types on that list (and not on the `entityBlackList`) will be included. This applies to all air treatment devices. It does not affect robot vacuum devices.
| `deviceEntityBlackList` | `[]`    | Per-device `entityBlackList`-style selection of endpoints. This only applies to air treatment devices. It is an object where the keys are device serial numbers, and the values are the list of endpoint device types that will be excluded for that device.
| `debug`                 | `false` | Sets the logger level for this plugin to *Debug*, overriding the global Matterbridge logger level setting.
| `debugFeatures`         | `[]`    | Miscellaneous options to control the information logged. None of these should be set unless you are investigating a compatibility issue, MQTT message error, or other problem.
| `unregisterOnShutdown`  | `false` | Unregister all exposed devices on shutdown. This is used during development and testing; do not set it for normal use.

The various black/white lists control which robot vacuum and air treatment devices are exposed as Matter devices. Robot vacuums are always exposed as a simple Matter device on a single endpoint, but air treatment devices are implemented as multiple devices and endpoints that can be individually included or excluded. A device or endpoint must pass all the black/white list filters to be exposed (logical AND). This applies cumulatively across global and per-device filters. Devices are identified via their serial numbers (the same as their MQTT username) and endpoints are identified using their Matter device type: `Air Purifier`, `Air Quality Sensor`, `Composed Air Purifier` (a composed device consisting of an `Air Purifier` with all other relevant device types as children), `Humidity Sensor`, `Temperature Sensor`, or `Thermostat`.

The supported `debugFeatures` are:
- `Log Endpoint Debug`: Sets the `debug` flag to the Matterbridge/Matter.js endpoint implementation.
- `Log MQTT Client`: Enables (extremely) verbose debug logging from the low-level MQTT client. This is unlikely to be useful unless the plugin is unable to establish or maintain a connection to the Dyson device. (Requires *Debug* level logging.)
- `Log MQTT Payloads`: Enables logging of every MQTT payload that is sent or received. This is useful for diagnosing interoperability issues or identifying how to control new features. (Requires *Debug* level logging.)
- `Log Serial Numbers`: By default product serial numbers (a.k.a. MQTT usernames) and passwords are automatically redacted in the log. This setting logs serial numbers verbatim.
- `Log Debug as Info`: Redirect *Debug* level logging to *Info* level. This makes it visible in the Matterbridge frontend.

</details>

## Functionality

The following sections describe the functionality exposed to Matter. Different ecosystems vary in their level of support; many Matter controllers will only provide access to a limited subset of this functionality.

<details>
<summary>Robot Vacuums</summary>

Each robot vacuum appears as a standalone Matter device with a single endpoint. This supports basic start/stop/pause/resume control and changing power mode. Detailed status information is provided for the robot vacuum's activity, battery, and any faults.

Zone cleaning and mapping control are not currently supported, as Dyson's MQTT API does not appear to expose these functions.

#### Robotic Vacuum Cleaner Device

- **RVC Run Mode** cluster:
  - `Idle`: Abort cleaning and return to dock (same as `GoHome`).
  - `Cleaning`: Start a full-clean.
  - `Mapping`: Status only; no information is available about how to initiate mapping via MQTT.

- **RVC Clean Mode** cluster:
  | Mode       | Dyson 360 Eye | Dyson Heurist | Dyson Vis Nav |
  | ---------- | :-----------: | :-----------: | :-----------: |
  | `Quiet`    | Quiet         | Quiet         | Quiet         |
  | `Quick`    |               |               | Quick         |
  | `High`     |               | High          |               |
  | `MaxBoost` | Max           | Max           | Boost         |
  | `Auto`     |               |               | Auto          |

**RVC Operational State** cluster:
  - `Pause`: Pause cleaning or mapping activity.
  - `Resume`: Resume from a paused state.
  - `GoHome`: Abort cleaning and return to dock (same as `Idle`).
  - *OperationalState* (`Stopped`, `Running`, `Paused`, `Error`, `SeekingCharger`, `Charging`, or `Docked`).
  - Any active fault.

**Power Source** cluster:
  - Battery charge level and charging status.
  - Any active fault.

No **Service Area** cluster is implemented, due to absence of information about how to control zone cleaning via MQTT.

</details>

<details>
<summary>Air Treatment Devices</summary>

This plugin implements multiple Matter device types to support most of the functionality and sensors of air treatment devices:
- **Air Purifier**
- **Air Quality Sensor**
- **Humidity Sensor**
- **Temperature Sensor**
- **Thermostat** (*Heat+Cool* only)

You can expose each endpoint (sensor, thermostat, purifier) as a standalone Matter device, or group them into a single composed device with multiple endpoints. Some Matter controllers may display multiple instances of the same sensor due to overlap between standalone and composed devices. Use the black/white lists to control which devices are exposed.

Only one **Air Purifier** and one **Thermostat** can be exposed per physical device:
- If the standalone **Air Purifier** (`Air Purifier`) is enabled then the composed device (`Composed Air Purifier`) is disabled implicitly.
- If the standalone **Thermostat** (`Thermostat`) device is enabled, then heating controls are not included in any composed device.

Sensor devices can be duplicated, e.g. the measured temperature may be reported simultaneously in all of these:
- Standalone **Air Quality Sensor** device 
  - **Temperature Measurement** cluster > *MeasuredValue* attribute
- Standalone **Temperature Sensor** device
  - **Temperature Measurement** cluster > *MeasuredValue* attribute
- Composed **Air Purifier** device
  - Child **Air Quality Sensor** device 
    - **Temperature Measurement** cluster > *MeasuredValue* attribute
  - Child **Temperature Sensor** device
    - **Temperature Measurement** cluster > *MeasuredValue* attribute
  - Child (or standalone) **Thermostat** device
    - **Thermostat** cluster > *Local Temperature* attribute

#### Air Purifier Device

- **On/Off** cluster:
  - Turn fan on/off (preserving speed setting)
- **Fan Control** cluster:
  - Turn fan on/off (losing speed setting)
  - Fan speed or auto
  - Fan direction (not *(Hot+)Cool Link*)
  - Night mode = `SleepWind`
  - Side-to-side oscillation (not *Big+Quiet*) = `RockLeftRight`
  - "Breeze" (*Humidify+Cool* only) = `NaturalWind`
  - Tilt "breeze" oscillation (*Big+Quiet* only) = `RockUpDown`
- **HEPA Filter Monitoring** cluster:
  - Remaining HEPA (or combined) filter life
- **Activated Carbon Filter Monitoring** cluster:
  - Remaining activated carbon filter life (*Big+Quiet* only)

#### Air Quality Sensor Device

- **Air Quality** cluster:
  - Synthesized qualitative air quality:
    1. Each available pollutant measurement (including the *Pure (Hot+)Cool Link* qualitative particulate measurement) is categorised as Good, Fair, Moderate, Poor, Very Poor, or Extremely Poor. This uses US EPA AQI breakpoints, WHO guidelines, other guidelines, and arbitrary mappings of qualitative measurements.
    1. The worst classification is used as the overall air quality.
- **Temperature Measurement** cluster:
  - Measured temperature, if available
- **Relative Humidity Measurement** cluster:
  - Measured relative humidity (%), if available
- **Total Volatile Organic Compounds Concentration Measurement** cluster:
  - Measured VOC (qualitative), if available
- **Carbon Dioxide Concentration Measurement** cluster:
  - Measured CO2 (ppm), if available
- **Nitrogen Dioxide Concentration Measurement** cluster:
  - Measured NOx (qualitative), if available
- **Formaldehyde Concentration Measurement** cluster:
  - Measured Formaldehyde level (µg/m³), if available
- **PM2.5 Concentration Measurement** cluster:
  - Measured small particulates (µg/m³), if available
- **PM10 Concentration Measurement** cluster:
  - Measured large particulates (µg/m³), if available

#### Humidity Sensor Device

- **Relative Humidity Measurement** cluster:
  - Measured relative humidity, if available

#### Temperature Sensor Device

- **Temperature Measurement** cluster:
  - Measured temperature, if available

#### Thermostat Device (*Heat+Cool* only)

- **Thermostat** cluster:
  - Enable/disable heating
  - Target temperature
  - Measured temperature, if available

</details>

## Compatibility

This plugin has only been tested with the following devices:
| Description                | Model | MQTT Root Topic | Firmware    |
| -------------------------- | :---: | :-------------: | :---------: |
| Dyson 360 Eye robot vacuum | RB01  | `N223`          | `11.3.5.10` |
| Dyson Pure Cool Link       | TP02  | `475`           | `21.04.03`  |
| Dyson Pure Hot+Cool Link   | HP02  | `455`           | `21.04.03`  |

It may also work with other Dyson robot vacuums and air treatment devices, although some modifications may be required for full compatibility.

Dyson Vis Nav firmware update `RB03PR.01.08.006.5079` (released 11th April 2024) disabled local MQTT capability, so cannot be supported by this plugin. (That probably comes under "Enhanced Wi-Fi connectivity" in the firmware release note...)

Matter controllers vary in their support for different device types. This plugin is only tested with Apple HomeKit and the Apple Home app.

### Matter Limitations

The Matter 1.4 specification does not define any device types or clusters for controlling humidification, so this plugin does not support that aspect of Pure Humidify+Cool devices.

### Apple Home Limitations

The Apple Home app in iOS/iPadOS 18.4 has limited Matter support, with multiple idiosyncrasies.

#### Robot Vacuums

The Apple Home app expects each robot vacuum to be a standalone, individually-paired Matter node implementing a single endpoint. However, Matterbridge acts as a Matter bridge - either a single bridge node for all plugins (*bridge* mode), or a separate bridge node per plugin (*childbridge* mode) - with each plugin's device exposed as an additional child endpoint. This causes a few issues when using this plugin with the Home app:
* **One robot vacuum per Matterbridge instance:** A separate Matterbridge instance is required for each robot vacuum. Each must use unique port numbers (both `-port <port>` and `-frontend <port>`) and their own home directory (`-homedir <path>`). This plugin should be the only one enabled in each instance, and only a single robot vacuum device should be configured in each instance.
* **Device-specific information is ignored:** The Home app shows the bridge device information from Matterbridge’s own root **Device Basic Information** cluster, ignoring the plugin’s **Bridged Device Basic Information** cluster. As a result, the Home app displays the bridge’s name, manufacturer, model, serial number, and firmware version; *not* those of the robot vacuum.

Other quirks in the Home app:
* **Incorrect clean mode display:** The Home app displays ModeTag values (e.g. *Deep Clean*, *Low Noise*) rather than the advertised modes (*Quiet*, *Max*, etc) reported by the vacuum. It also only shows these when not cleaning, even though Dyson robot vacuums support changing the power mode during a clean.

#### Air Treatment Devices

The Apple Home app only supports simple Matter devices correctly. When multiple devices are composed into a single bridged device, or subset device types are included, the Home app exhibits multiple issues:
* The device icon can be for any of the composed or subset device types, instead of selecting the most relevant (the first recognised device type on the parent endpoint), e.g. an **Air Purifier** device may be randomly shown as a **Fan Device** or **Air Quality Sensor** instead.
* Controls may be duplicated in the user interface if they can correspond to multiple overlapping device types, e.g. two fan speed sliders are shown if a device describes itself as both an Air Purifier and a Fan Device.
* Functionality is often reduced, e.g. including an **Air Quality** device in an **Air Purifier** device hides *Auto* mode, fan oscillation controls, and all sensor measurements.

For these reasons, this plugin defaults to bridging each Matter device type separately. A composed device can be selected instead by setting `entityWhiteList` to `["Composed Air Purifier"]` and `entityBlackList` to `[]`.

Other quirks in the Home app:
* HEPA and carbon filter status is not shown (despite being part of the Matter Air Purifier device specification, and them being supported via the HomeKit Accessory Protocol).
* Other sensor measurements (CO2, Formaldehyde, NOx, PM2.5, PM10, and VOC) are not shown.

## Changelog

All notable changes to this project are documented in the [CHANGELOG.md](CHANGELOG.md) file.

## Reporting Issues
          
If you have discovered an issue or have an idea for how to improve this project, please [open a new issue](https://github.com/thoukydides/matterbridge-dyson-robot/issues/new/choose) using the appropriate issue template.

### Pull Requests

This project does **NOT** accept pull requests. Any PRs submitted will be closed without discussion. For more details refer to the [`CONTRIBUTING.md`](https://github.com/thoukydides/.github/blob/master/CONTRIBUTING.md) file.

## ISC License (ISC)

<details>
<summary>Copyright © 2025 Alexander Thoukydides</summary>

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</details>