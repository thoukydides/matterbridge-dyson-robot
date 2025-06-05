<p align="center">
  <img src="https://raw.githubusercontent.com/wiki/thoukydides/matterbridge-dyson-robot/matterbridge-dyson-robot.svg" height="200">
</p>
<div align=center>

# matterbridge-dyson-robot

[![npm](https://badgen.net/npm/v/matterbridge-dyson-robot)](https://www.npmjs.com/package/matterbridge-dyson-robot)
[![npm](https://badgen.net/npm/dt/matterbridge-dyson-robot)](https://www.npmjs.com/package/matterbridge-dyson-robot)
[![npm](https://badgen.net/npm/dw/matterbridge-dyson-robot)](https://www.npmjs.com/package/matterbridge-dyson-robot)
[![Build and Lint](https://github.com/thoukydides/matterbridge-dyson-robot/actions/workflows/build.yml/badge.svg)](https://github.com/thoukydides/matterbridge-dyson-robot/actions/workflows/build.yml)
[![Test](https://github.com/thoukydides/matterbridge-dyson-robot/actions/workflows/test.yml/badge.svg)](https://github.com/thoukydides/matterbridge-dyson-robot/actions/workflows/test.yml)

A [Matterbridge](https://github.com/Luligu/matterbridge) plugin that connects [Dyson](https://www.dyson.co.uk/) robot vacuums and air treatment devices  
to the [Matter](https://csa-iot.org/all-solutions/matter/) smart home ecosystem via their local or cloud MQTT APIs.

</div>

## Installation

This plugin supports multiple methods for configuring and connecting to Dyson robot vacuum and air treatment devices. The following instructions are for cloud-based connection via a MyDyson account and the Dyson AWS IoT MQTT gateway, which is the recommended approach (and the only one compatible with Dyson 360 Vis Nav robot vacuums). See [Alternative Provisioning Methods](#provisioning-methods) (below) for options to connect to supported devices locally.

### Step 1 - Create Account and Connect Devices
1. Use the MyDyson [iPhone](https://apps.apple.com/gb/app/mydyson/id993135524) or [Android](https://play.google.com/store/apps/details?id=com.dyson.mobile.android) app to create an account.
1. Add the Dyson robot vacuum cleaner and/or air treatment devices to your Dyson account.

### Step 2 - Matterbridge Plugin Installation
1. Open the Matterbridge web interface, e.g. at http://localhost:8283/.
1. Under *Install plugins* type `matterbridge-dyson-robot` in the *Plugin name or plugin path* search box, then click *Install ⬇️*.
1. Click *🔄 Restart Matterbridge* to apply the change.
1. Open the **matterbridge-dyson-robot** *⚙️ Plugin config*.
1. Ensure that **provisioningMethod** is set to `Connect via AWS IoT gateway / Configure using MyDyson account`.
1. Under **MyDyson Account Configuration** enter the email address and password that you use with the MyDyson app.
1. If your account is registered in China then select the `china` option.
1. Click the <kbd>START AUTH</kbd> button.
1. You should receive a **Log in to your MyDyson App** email message containing a code. Enter that code and click the <kbd>SUBMIT CODE</kbd> button.
1. When you see messages indicating that the account has been authorised click <kbd>CONFIRM</kbd> to save the configuration, and restart Matterbridge.

| ⚠️ Apple HomeKit + Robot Vacuums  |
| --- |
| *The Apple Home app only supports robot vacuums when they are standalone individually-paired Matter nodes. Attempting to pair a Matterbridge instance with multiple robot vacuums, or a robot vacuum plus other device types, can cause the Home app to crash or fail to properly recognise some of the devices. If you are using HomeKit with a robot vacuum then configure a separate Matterbridge instance for each robot vacuum.* |

<details>
<summary>Separate Matterbridge Instance per Robot Vacuum</summary>

### Separate Matterbridge Instances

Each additional Matterbridge instance should specify the following command line options:

| Command Line Options    | Default                     | Description
| ----------------------- | --------------------------- | --
| `-homedir <directory>`  | `$HOME` or `USERPROFILE`    | Matterbridge defaults to creating `Matterbridge`, `.matterbridge`, and `.mattercert` directories within the user's home directory. A different "home" directory is required by each Matterbridge instance.
| `-port <number>`        | `5540`                      | The port number for the Matterbridge commissioning server. This should be unique for each instance to allow pairing with a Matter controller.
| `-frontend <number>`    | `8283`                      | The port number for the Matterbridge frontend. This should be unique for each instance to allow use of the web interface.
| `-vendorName "<name>"`  | `"Matterbridge"`            | Apple Home uses the vendor name of the Matter bridge for robot vacuums; use this option to override Matterbridge's default with `Dyson`.
| `-productName "<name>"` | `"Matterbridge aggregator"` | Apple Home uses the product name of the Matter bridge for robot vacuums; use this option to override Matterbridge's default with model name of your robot vacuum.

Select a single robot vacuum for each instance using the `whiteList` plugin configuration option. Conversely, the main Matterbridge instance can use the `blacklist` configuration option to exclude robot vacuums, if necessary.

#### Example `systemd` Configuration

The following example assumes that:
* `systemd` is being used to launch Matterbridge (instead of via Docker or other means).
* Matterbridge is run as user `matterbridge` and group `matterbridge`.
* Matterbridge configuration files for this instance are being kept under `/var/lib/matterbridge-dyson-robot`.
* The commissioning server will be on port `5541` and the web frontend on port `8284`.
* This instance is for a Dyson 360 Eye robot vacuum.

Modify as appropriate to suit your setup.

1. Create a directory for this instance's configuration files:
   ```shell
   sudo mkdir /var/lib/matterbridge-dyson-robot
   sudo chown matterbridge:matterbridge /var/lib/matterbridge-dyson-robot
   ```
1. Create a `/etc/systemd/system/matterbridge-dyson-robot.service` file containing:
   ```ini
   [Unit]
   Description=Matterbridge Dyson Robot
   After=network-online.target
   
   [Service]
   Type=simple
   ExecStart=/usr/local/bin/matterbridge -service -nosudo -novirtual -homedir /var/lib/matterbridge-dyson-robot -port 5541 -frontend 8284 -vendorName 'Dyson' -productName '360 Eye'
   WorkingDirectory=/var/lib/matterbridge-dyson-robot
   StandardOutput=inherit
   StandardError=inherit
   Restart=always
   RestartSec=10s
   TimeoutStopSec=30s
   User=matterbridge
   Group=matterbridge
   
   [Install]
   WantedBy=multi-user.target
   ```
1. Reload the `systemd` service files and enable the new unit:
   ```shell
   sudo systemctl daemon-reload
   sudo systemctl enable --now matterbridge-dyson-robot.service
   ```
</details>
<details>
<summary>Command Line Installation</summary>

### Installation using Command Line
1. Stop Matterbridge:  
   `sudo systemctl stop matterbridge`
1. Install the plugin:  
   `npm install -g matterbridge-dyson-robot`
1. Register it with Matterbridge:  
   `sudo -u matterbridge matterbridge -add matterbridge-dyson-robot`
1. Restart Matterbridge:  
   `sudo systemctl start matterbridge`

MyDyson account authorisation cannot be completed via the command line. See [Alternative Provisioning Methods](#provisioning-methods) (below) for token acquisition details or other provisioning methods that do not require MyDyson account access.

#### Example `matterbridge-dyson-robot.config.json`

```JSON
{
    "name":                     "matterbridge-dyson-robot",
    "type":                     "DynamicPlatform",
    "version":                  "1.0.0",
    "provisioningMethod":       "Remote Account",
    "dysonAccount": {
        "email":                "ripley@xeno.clean",
        "password":             "NoMoreDust!426",
        "china":                false
    },
    "wildcardTopic":            true,
    "blackList":                [],
    "whiteList":                [],
    "entityBlackList":          ["Composed Air Purifier", "Humidity Sensor", "Temperature Sensor"],
    "entityWhiteList":          [],
    "deviceEntityBlackList":    {},
    "debug":                    false,
    "debugFeatures":            [],
    "unregisterOnShutdown":     false
}
```

</details>
<details>
<summary>Advanced Configuration Options</summary>

### Advanced Configuration

You can include additional settings in `matterbridge-dyson-robot.config.json` to customise the behaviour or enable special debug features:

| Key                     | Default            | Description
| ----------------------- | ------------------ | ---
| `name`<br>`type`<br>`version` | n/a          | These are managed by Matterbridge and do not need to be set manually.
| `provisioningMethod`    | `"Remote Account"` | Selects how the plugin is configured and how it connects to the Dyson devices. See [Alternative Provisioning Methods](#provisioning-methods) (below) for details of each option.
| `devices[]`             | `[]`               | Local network and MQTT configuration for each Dyson device when not using the `Remote Account` provisioning method. See below for details.
| `wildcardTopic`         | `true`             | When set to `false` the plugin only subscribes to the essential status MQTT topic(s) appropriate for each device. Setting it to `true` additionally subscribes to the command topic (for AWS IoT connections) or to the `#` wildcard topic (for local network connections), receiving additional messages published by the devices or echoed by the MQTT brokers. This is useful for discovering new topics, seeing the commands issued by the MyDyson app (only some commands to robot vacuums), and verifying correct `root_topic` and `username` settings.
| `blackList`             | `[]`               | If the list is not empty, then any robot vacuum and air treatment devices with matching serial numbers will not be exposed as Matter devices.
| `whiteList`             | `[]`               | If the list is not empty, then only robot vacuum and air treatment devices with matching serial numbers (and not on the `blacklist`) will be exposed as Matter devices.
| `entityBlackList`       | `["Composed Air Purifier", "Humidity Sensor", "Temperature Sensor"]` | If the list is not empty, then any endpoint device types listed will be excluded. This applies to all air treatment devices. It does not affect robot vacuum devices.
| `entityWhiteList`       | `[]`               | If the list is not empty, then only endpoint device types on that list (and not on the `entityBlackList`) will be included. This applies to all air treatment devices. It does not affect robot vacuum devices.
| `deviceEntityBlackList` | `{}`               | Per-device `entityBlackList`-style selection of endpoints. This only applies to air treatment devices. It is an object where the keys are device serial numbers, and the values are the list of endpoint device types that will be excluded for that device.
| `debug`                 | `false`            | Sets the logger level for this plugin to *Debug*, overriding the global Matterbridge logger level setting.
| `debugFeatures`         | `[]`               | Miscellaneous options to control the information logged. None of these should be set unless you are investigating a compatibility issue, MQTT message error, or other problem.
| `unregisterOnShutdown`  | `false`            | Unregister all exposed devices on shutdown. This is used during development and testing; do not set it for normal use.

The various black/white lists control which robot vacuum and air treatment devices are exposed as Matter devices. Robot vacuums are always exposed as a simple Matter device on a single endpoint, but air treatment devices are implemented as multiple devices and endpoints that can be individually included or excluded. Devices and endpoints are exposed only if they pass all specified black/white list filters (logical AND operation applies). This applies cumulatively across global and per-device filters. Devices are identified via their serial numbers (the same as their MQTT username) and endpoints are identified using their Matter device type:
* `Air Purifier`
* `Air Quality Sensor`
* `Composed Air Purifier` (a composed device consisting of an `Air Purifier` with all other relevant device types as children)
* `Humidity Sensor`
* `Temperature Sensor`
* `Thermostat`

The supported `debugFeatures` are:

| Debug Feature          | Description
| ---------------------- | ---
| `Log Endpoint Debug`   | Sets the `debug` flag to the Matterbridge/Matter.js endpoint implementation.
| `Log API Headers`      | Logs HTTP headers for MyDyson API requests. Rarely useful. (Requires *Debug* level logging.)
| `Log API Bodies`       | Logs message bodies for MyDyson API requests. Useful for diagnosing interoperability issues. (Requires *Debug* level logging.)
| `Log MQTT Client`      | Enables (extremely) verbose debug logging from the low-level MQTT client. Rarely useful, unless the plugin is unable to establish or maintain a connection to the Dyson device. (Requires *Debug* level logging.)
| `Log MQTT Payloads`    | Logs every MQTT payload that is sent or received. Useful for diagnosing interoperability issues or identifying how to control new features. (Requires *Debug* level logging.)
| `Log Serial Numbers`   | By default product serial numbers (a.k.a. MQTT usernames) and passwords are automatically redacted in the log. This setting logs serial numbers verbatim.
| `Log Debug as Info`    | Redirect *Debug* level logging to *Info* level. This makes it visible in the Matterbridge frontend.

</details>
<a name="provisioning-methods"></a>
<details>
<summary>Alternate Provisioning Methods</summary>

### Provisioning Methods

| Provisioning Method | Connection Via... | Configuration Using...    | IP Addresses / Hostnames | MQTT Credentials    | Compatibility           |
| ------------------- | ----------------- | ------------------------- | ------------------------ | ------------------- | ----------------------- |
| `Remote Account`    | ☁️ AWS IoT Gateway | ☺️ MyDyson account         | ✅ Automatic              | ✅ Automatic         | ✅ All devices           |
| `Local Account`     | 🏠 Local Network   | 😐 MyDyson account         | ❌ Manual configuration   | ✅ Automatic         | ❌ Not Dyson 360 Vis Nav |
| `Local Wi-Fi`       | 🏠 Local Network   | 📡 Wi-Fi Setup credentials | ❌ Manual configuration   | ❌ Wi-Fi Setup label | ❌ Not Dyson 360 Vis Nav |
| `Local MQTT`        | 🏠 Local Network   | ⚠️ MQTT credentials        | ❌ Manual configuration   | ❌ Using `opendyson` | ❌ Not Dyson 360 Vis Nav |

The recommended `Remote Account` provisioning method routes all MQTT messages via the AWS IoT gateway, but the other methods enable direct local connection to the robot vacuum and air treatment devices (if supported by the device and its firmware). This requires manual configuration of the local network IP addresses or hostnames, and (for some methods) the credentials used to authorise the MQTT connection.

#### `Remote Account` (Connect via AWS IoT Gateway / Configure using MyDyson account)

```JSON
{
    "provisioningMethod":       "Remote Account",
    "dysonAccount": {
        "email":                "neo@matrix.clean",
        "password":             "ThereIsNoDust1",
        "china":                false
    }
}
```

The `Remote Account` provisioning obtains all required details from the MyDyson account. Connection to the devices is via the AWS IoT gateway, with new credentials retrieved from the MyDyson account for each (re)connection. No other configuration is required.

As an alternative to authorising MyDyson account access using an email, password, and OTP code, it is possible to use a previously authorised access token (e.g. if using `opendyson` it can be found in `~/.config/libdyson/config.yml`):
```JSON
{
    "provisioningMethod":       "Remote Account",
    "dysonAccount": {
        "token":                "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF-1",
        "china":                false
    }
}
```

The access token may also be supplied via a `DYSON_TOKEN` environment variable.

#### `Local Account` (Connect via Local Network / Configure using MyDyson account)

```JSON
{
    "provisioningMethod":       "Local Account",
    "dysonAccount": {
        "email":                "spock@logic.clean",
        "password":             "LiveLong&Vacuum",
        "china":                false
    },
    "devices": [{
        "serialNumber":         "ST1-FD-NCC1701E",
        "host":                 "enterprise-vac.local",
        "port":                 1883
    }, {
        "serialNumber":         "SK1-NY-TRM8008X",
        "host":                 "192.168.0.100",
        "port":                 1883
    }],
}
```

The `Local Account` provisioning obtains the MQTT credentials and configured device names from the MyDyson account; it just requires manual configuration of the IP address or hostname for each device. The device's serial number is used to uniquely identify each device.

The MyDyson account is accessed each time that the plugin is (re)started. All subsequent access is restricted to the local network.

#### `Local Wi-Fi` (Connect via Local Network / Configure using Wi-Fi Setup credentials)

```JSON
{
    "provisioningMethod":       "Local Wi-Fi",
    "devices": [{
        "name":                 "Katniss Everclean",
        "host":                 "katniss.local",
        "port":                 1883,
        "ssid":                 "360EYE-KE1-RE-DAH1234C",
        "password":             "abcdefgh"
    }, {
        "name":                 "Hoth Breeze",
        "host":                 "192.168.0.100",
        "port":                 1883,
        "ssid":                 "DYSON-HB1-ES-TAT9001F-475",
        "password":             "abcdefgh"
    }],
}
```

The `Local Wi-Fi` provisioning uses the Wi-Fi setup credentials to derive the MQTT credentials. Manual configuration is required for the credentials, IP address or hostname, and a friendly name (used as the Matter *NodeLabel*), for each device.

This provisioning method does not use the MyDyson account or any other cloud services. Only local network access is used.

The Wi-Fi setup information can be found on a label located:
- behind the clean bin of robot vacuums,
- underneath the base of air treatment devices, or
- attached to the operating manual.

The **Product SSID** (`ssid`) and **Product Wi-Fi Password** (`password`) are case-sensitive and must be entered exactly as shown on the label.

#### `Local MQTT` (Connect via Local Network / Configure using MQTT credentials)

```JSON
{
    "provisioningMethod":       "Local MQTT",
    "devices": [{
        "name":                 "House Elf Hoover",
        "serialNumber":         "HE1-HP-WIZ7654M",
        "host":                 "dobbie.local",
        "port":                 1883,
        "password":             "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNOPQRSTUV==",
        "rootTopic":            "276"
    }, {
        "name":                 "Whisper of Valinor",
        "serialNumber":         "WV1-SI-ELF1984H",
        "host":                 "192.168.0.100",
        "port":                 1883,
        "password":             "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABCDEFGHIJKLMNOPQRSTUV==",
        "rootTopic":            "455"
    }],
}
```

The `Local MQTT` provisioning requires manual configuration of the MQTT credentials, as well as the IP address or hostname, and a friendly name (used as the Matter *NodeLabel*), for each device.

This provisioning method does not use the MyDyson account or any other cloud services. Only local network access is used.

The easiest way to obtain the MQTT credentials is by using the [`opendyson`](https://github.com/libdyson-wg/opendyson) tool:
1. Install `opendyson`, e.g. if `Go` is installed and configured:  
   `go install github.com/libdyson-wg/opendyson`
1. Login to your MyDyson account:  
   `opendyson login`
1. Identify devices and retrieve their connection credentials:  
   `opendyson devices`

The values required to configure this plugin are:

| `opendyson devices` Output | Plugin Configuration |
| -------------------------- | -------------------- |
| `mqtt` → `username`        | `serialNumber`       |
| `mqtt` → `password`        | `password`           |
| `mqtt` → `root_topic`      | `rootTopic`          |

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

No **Service Area** cluster is implemented; zone cleaning does not appear to be controllable via MQTT commands.

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

It should also work with other Dyson robot vacuums and air treatment devices, although some modifications may be required for full compatibility.

Matter controllers vary in their support for different device types. This plugin is only tested with Apple HomeKit and the Apple Home app.

### Matter Limitations

The following functionality is not supported by this plugin due to lack of appropriate device types, clusters, or attributes, in the Matter 1.4 specification:
<details>
<summary>Air Purifiers</summary>

* Fan diffuser/focus *(Pure (Hot+)Cool Link)*
* Humidification *(Pure Humidify+Cool)*
* Oscillation angles *(Pure (Hot)+Cool family)* or tilt angles *(Big+Quiet family)*
* Sleep timer
* Faults
</details>

### Apple Home Limitations

The Apple Home app in iOS/iPadOS 18.4 and macOS Sequoia has limited Matter support and exhibits multiple idiosyncrasies.

<a name="apple-home-rvc"></a>
<details>
<summary>Robot Vacuums</summary>

The Apple Home app expects each robot vacuum to be a standalone, individually-paired Matter node implementing a single endpoint. However, Matterbridge acts as a Matter bridge - either a single bridge node for all plugins (*bridge* mode), or a separate bridge node per plugin (*childbridge* mode) - with each plugin's device exposed as an additional child endpoint. This causes a few issues when using this plugin with the Home app:
* **Multiple bridged devices:** A Matter bridge that exposes a robot vacuum plus other devices can crash the Home app. Hence, a separate Matterbridge instance is required for each robot vacuum. This plugin should be the only one enabled in each instance, and only a single robot vacuum device should be configured in each instance.
* **Device-specific information is ignored:** The Home app shows the bridge device information from Matterbridge's own root **Device Basic Information** cluster, ignoring the plugin's **Bridged Device Basic Information** cluster. As a result, the Home app displays the bridge's name, manufacturer, model, serial number, and firmware version; *not* those of the robot vacuum. The correct values can be specified using Matterbridge's command line options.

Other quirks in the Home app:
* **Incorrect RVC Clean Mode display:** The Home app displays ModeTag values (e.g. *Deep Clean*, *Low Noise*) rather than the advertised modes (*Quiet*, *Max*, etc) reported by the robot vacuum. It also only shows these when not cleaning, even though Dyson robot vacuums support changing the power mode during a clean.
</details>
<details>
<summary>Air Purifiers</summary>

The Apple Home app only supports simple Matter devices correctly. When multiple devices are composed into a single bridged device, or subset device types are included, the Home app exhibits multiple issues:
* The device icon can be for any of the composed or subset device types, instead of selecting the most relevant (the first recognised device type on the parent endpoint), e.g. an **Air Purifier** device may be randomly shown as a **Fan Device** or **Air Quality Sensor** instead.
* Controls may be duplicated in the user interface if they can correspond to multiple overlapping device types, e.g. two fan speed sliders are shown if a device describes itself as both an **Air Purifier** and a **Fan** device.
* Functionality is often reduced, e.g. an **Air Purifier** incorporating an **Air Quality** device results in the *Auto* mode, fan oscillation controls, and all sensor measurements, being hidden.

For these reasons, this plugin defaults to bridging each Matter device type separately. A composed device can be selected instead by setting:
```JSON
{
    "entityWhiteList": ["Composed Air Purifier"],
    "entityBlackList": []
}
```

The Home app does not show any of the following (despite being part of the Matter **Air Purifier** device specification, and supported via the HomeKit Accessory Protocol):
* HEPA and carbon filter status.
* Other sensor measurements (CO2, Formaldehyde, NOx, PM2.5, PM10, and VOC).
</details>

## Changelog

All notable changes to this project are documented in [`CHANGELOG.md`](CHANGELOG.md).

## Reporting Issues
          
If you have discovered an issue or have an idea for how to improve this project, please [open a new issue](https://github.com/thoukydides/matterbridge-dyson-robot/issues/new/choose) using the appropriate issue template.

### Pull Requests

As explained in [`CONTRIBUTING.md`](https://github.com/thoukydides/.github/blob/master/CONTRIBUTING.md), this project does **NOT** accept pull requests. Any PRs submitted will be closed without discussion.

## Legal

This is an independent open-source project that is not affiliated with, endorsed by, or officially supported by [Dyson Technology Limited](https://www.dyson.co.uk/). This plugin interacts with Dyson devices and cloud services using APIs that have been discovered through reverse engineering, as permitted under Section 50B of the UK Copyright, Designs and Patents Act 1988, which implements the EU Directive 2009/24/EC on the legal protection of computer programs. These APIs are not publicly documented or supported by Dyson.

This plugin enables essential status monitoring and control interoperability between supported Dyson devices and home automation ecosystems, while making conservative use of the Dyson cloud services, typically resulting in fewer API requests than the official Dyson app.

However, Dyson may change their APIs or terms of service at any time, potentially rendering this plugin non-functional or causing unexpected behaviour. By using this plugin, you acknowledge and accept the inherent risks associated with interacting with unofficial APIs. Your use of this plugin is entirely at your own risk. If Dyson chooses to offer an official API or integration mechanism, this project will aim to migrate to that instead.

Dyson, Dyson Cool, Dyson Hot, Dyson Hot+Cool, Dyson Pure, Dyson Pure Cool, Dyson Pure Cool Link, Dyson Pure Hot+Cool Link, Dyson Pure Humidify+Cool, Dyson 360 Eye, Dyson 360 Heurist, and Dyson 360 Vis Nav, are trademarks of Dyson Technology Limited.

### ISC License (ISC)

<details>
<summary>Copyright © 2025 Alexander Thoukydides</summary>

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</details>