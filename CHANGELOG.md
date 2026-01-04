# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v1.8.4] - 2026-01-04
### Fixed
* Accept additional changes to MQTT messages for Dyson 360 Vis Nav.

## [v1.8.3] - 2026-01-03
### Fixed
* Accept additional API capability and corrected MQTT root topic for the Spot+Scrub Ai. (#17)
### Changed
* Updated dependencies.

## [v1.8.2] - 2026-01-02
### Fixed
* Accept additional changes to MQTT messages for Dyson 360 Vis Nav.
### Changed
* Dyson 360 Vis Nav cleaned area maps now use the orientation selected in the MyDyson app.

## [v1.8.1] - 2026-01-01
### Fixed
* Support Dyson 360 Vis Nav cleaned area maps without an associated persistent map.
* Wait for cleaned area maps to be available at the end of a clean.

## [v1.8.0] - 2025-12-31
### Added
* Dyson 360 Eye and Dyson 360 Vis Nav robot vacuum cleaned area maps are retrieved from the MyDyson account and displayed in the log at the end of each clean. This requires `Remote Account` provisioning, and is controlled by the new `logMapStyle` configuration option.
### Removed
* Cleaned area maps in MQTT messages are no longer processed.
### Fixed
* Accept additional changes to MQTT messages for Dyson 360 Vis Nav.
### Changed
* Updated dependencies.

## [v1.7.0] - 2025-12-24
### Added
* Zone cleaning (Service Areas) implemented for Dyson 360 Vis Nav.
* Improved Apple Home compatibility for robot vacuum devices by only tagging each cleaning mode with a single ModeTag. This is controlled by the new `simpleModeTagsRvc` configuration option.
### Fixed
* Accept additional changes to MQTT messages for Dyson 360 Vis Nav.

## [v1.6.9] - 2025-12-18
### Fixed
* Accept additional changes to MQTT messages for Dyson 360 Vis Nav.
### Changed
* Updated dependencies.

## [v1.6.8] - 2025-12-14
### Fixed
* Accept `HELLO` MQTT messages from BP03.
### Changed
* Updated dependencies.

## [v1.6.7] - 2025-11-18
### Changed
* Restored "snackbar" messages for authentication progress.

## [v1.6.6] - 2025-11-17
### Changed
* Compatibility with Matterbridge version 3.4.0.
* Updated dependencies.

## [v1.6.5] - 2025-10-15
### Changed
* Updated dependencies.

## [v1.6.4] - 2025-10-13
### Fixed
* Accept additional changes to MQTT messages for Dyson 360 Vis Nav. (#16)

## [v1.6.3] - 2025-10-13
### Fixed
* Accept missing default power mode for Dyson 360 Vis Nav. (#16)

## [v1.6.2] - 2025-10-12
### Fixed
* Accept cleaning strategy and power mode for Dyson 360 Vis Nav. (#16)
* Accept product error codes from PH02. (#16)
* Accept carbon filter type from PH04. (#16)

## [v1.6.1] - 2025-10-12
### Fixed
* Accept additional firmware capabilities for Dyson 360 Vis Nav. (#16)
### Changed
* Updated dependencies.

## [v1.6.0] - 2025-10-08
### Changed
* Cope with devices that are unreachable during start-up by using cached device details (if available).
* No MQTT connection is attempted for devices disabled via `blackList` or `whiteList`.

## [v1.5.0] - 2025-10-04
### Changed
* Compatibility with Matterbridge version 3.4.0.
* Use Dyson's official Matter Vendor ID (`0x139E`).
* Updated dependencies.

## [v1.4.2] - 2025-09-29
### Fixed
* Accept `CURRENT-STATE` MQTT messages from Dyson 360 Heurist. (#13)
* Accept product error codes from HP04. (#13)

## [v1.4.1] - 2025-09-29
### Fixed
* Accept non-connected devices in MyDyson account. (#13)

## [v1.4.0] - 2025-09-29
### Fixed
* Accept additional firmware capabilities for Dyson 360 Heurist. (#11, #13)
### Changed
* Updated dependencies.

## [v1.3.3] - 2025-09-07
### Changed
* More robust robot vacuum map rendering.

## [v1.3.2] - 2025-09-07
### Fixed
* Accept `HELLO` MQTT messages from BP03.

## [v1.3.1] - 2025-09-06
### Added
* PH05 as additional model using MQTT topic 358K.
### Changed
* Improved logging of MQTT connection errors.
* Updated dependencies.

## [v1.3.0] - 2025-09-05
### Added
* Robot vacuum cleaned area maps are displayed in the log at the end of each clean. This is controlled by the new `logMapStyle` configuration option.

## [v1.2.1] - 2025-08-30
### Added
* MyDyson account API requests are now retried to cope with transient internal server errors.
* `Log MQTT Payloads as JSON` debug option captures full MQTT payloads in JSON format without truncation or duplicate suppression.

## [v1.2.0] - 2025-08-26
### Added
* Improved test coverage using MQTT payload logs to mock devices.
### Fixed
* Cope with absence of temperature and humidity sensors on TP11/PC1.
* Accept `LOCATION` MQTT messages from TP11/PC1.
* Accept previously unseen error codes (`02C3`, `12D2`, `12E1`, `26U1`, `31U2`, and `34U5`).
* Accept 350° oscillation range on TP04 and HP09.
* Accept new HEPA (`PHEP` on TP04) and carbon (`SCOF` on HP07, TP07, and TP09) filter types.

## [v1.1.4] - 2025-08-23
### Changed
* Updated dependencies.

## [v1.1.3] - 2025-08-02
### Changed
* Accept more MQTT payload variations.

## [v1.1.2] - 2025-08-01
### Added
* Added TP12 and PC2 to configuration schema.
### Changed
* Updated dependencies.

## [v1.1.1] - 2025-07-31
### Added
* TP12 and PC2 as additional models using MQTT topic 438K.
### Changed
* Updated dependencies.

## [v1.1.0] - 2025-07-27
### Added
* Dyson Cool CF1/AM12 support.
### Changed
* Updated dependencies.

## [v1.0.4] - 2025-07-20
### Changed
* Cope with missing `batteryChargeLevel` in Dyson 360 Eye MQTT messages.
* Updated dependencies.

## [v1.0.3] - 2025-07-09
### Changed
* Added new MQTT command parameters for Dyson 360 Eye.

## [v1.0.2] - 2025-07-09
### Changed
* Improved logging of aggregated errors or those indicating another error as their cause.
* Updated dependencies.

## [v1.0.1] - 2025-07-06
### Fixed
* Resolved problems with multiple robot vacuums in a single Matterbridge instance, caused by duplicate Matter.js enum values.

## [v1.0.0] - 2025-07-05
### Added
* Improved Apple Home compatibility for robot vacuum devices by using Matterbridge's `server` mode, which exposes each robot vacuum as a standalone Matter node instead of bridging them. This mode is enabled by default and requires robot vacuum devices to be re-paired with the Matter controller. It can be disabled by setting the `"enableServerRvc": false` configuration option. Requires Matterbridge version 3.1.1 or later.
### Fixed
* Corrected `productUrl` attribute values in the Bridged Device Basic Information cluster.
### Changed
* Updated dependencies.

## [v0.2.10] - 2025-06-28
### Added
* Added support for HP1/HP11.
### Changed
* Updated dependencies.

## [v0.2.9] - 2025-06-21
### Changed
* Added missing MQTT messages and values for BP03.
* Updated dependencies.

## [v0.2.8] - 2025-06-13
### Changed
* Workaround breaking changes in Matterbridge 3.0.6.
* Updated dependencies.

## [v0.2.7] - 2025-05-27
### Fixed
* Added missing MQTT state and fault values for TP09. (#1, #2)
* Corrected update of CO2 and Formaldehyde sensor readings. (#2)

## [v0.2.6] - 2025-05-31
### Added
* Added support for TP11/PC1.
### Changed
* Updated dependencies.

## [v0.2.5] - 2025-05-27
### Added
* Added missing MQTT state and fault values for TP04. (#1)

## [v0.2.4] - 2025-05-26
### Changed
* Revised README and package identifiers.

## [v0.2.3] - 2025-05-24
### Added
* Added missing MQTT status value.
### Changed
* Minor logging improvements.

## [v0.2.2] - 2025-05-23
### Added
* Support `MACHINE_OFF` robot vacuum state (sometimes reported by the AWS IoT MQTT broker).
* Use `GONE-AWAY` and `GOODBYE` messages as indications that the device is unreachable.
* Accept `HELLO` commands from robot vacuums.
### Fixed
* Reachability is indicated for air treatment machines. Previously it was only set for robot vacuums.
### Changed
* Update of multiple attributes in the same cluster are now sequenced to avoid transaction collisions.

## [v0.2.1] - 2025-05-22
### Fixed
* Avoid unnecessary attribute updates.

## [v0.2.0] - 2025-05-22
### Added
* MQTT credentials for each device can be obtained from the associated MyDyson account, minimising the required manual configuration.
* Connections can now be routed via the Dyson AWS IoT gateway. This allows use of devices and firmware versions that do not support local MQTT connections.
### Fixed
* Compatibility with Matterbridge version 3.0.3.
* Fan speed (`SpeedSetting` and `PercentSetting`) is set to `null` in `Auto` mode.
### Changed
* The configuration schema has been revised to support the MyDyson account and AWS IoT features. Previous configurations will need to be updated.
* Updated dependencies.

## [v0.1.1] - 2025-05-16
### Changed
* Improved configuration schema with enum to select `entityWhiteList`/`entityBlackList` values.

## [v0.1.0] - 2025-05-16
* Initial version.

---

Copyright © 2025-2026 Alexander Thoukydides

[Unreleased]:       https://github.com/thoukydides/matterbridge-dyson-robot/compare/v1.8.4...HEAD
[v1.8.4]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.8.3...v1.8.4
[v1.8.3]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.8.2...v1.8.3
[v1.8.2]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.8.1...v1.8.2
[v1.8.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.8.0...v1.8.1
[v1.8.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.7.0...v1.8.0
[v1.7.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.9...v1.7.0
[v1.6.9]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.8...v1.6.9
[v1.6.8]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.7...v1.6.8
[v1.6.7]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.6...v1.6.7
[v1.6.6]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.5...v1.6.6
[v1.6.5]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.4...v1.6.5
[v1.6.4]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.3...v1.6.4
[v1.6.3]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.2...v1.6.3
[v1.6.2]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.1...v1.6.2
[v1.6.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.6.0...v1.6.1
[v1.6.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.5.0...v1.6.0
[v1.5.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.4.2...v1.5.0
[v1.4.2]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.4.1...v1.4.2
[v1.4.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.4.0...v1.4.1
[v1.4.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.3.3...v1.4.0
[v1.3.3]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.3.2...v1.3.3
[v1.3.2]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.3.1...v1.3.2
[v1.3.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.3.0...v1.3.1
[v1.3.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.2.1...v1.3.0
[v1.2.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.2.0...v1.2.1
[v1.2.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.1.4...v1.2.0
[v1.1.4]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.1.3...v1.1.4
[v1.1.3]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.1.2...v1.1.3
[v1.1.2]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.1.1...v1.1.2
[v1.1.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.1.0...v1.1.1
[v1.1.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.0.4...v1.1.0
[v1.0.4]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.0.3...v1.0.4
[v1.0.3]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.0.2...v1.0.3
[v1.0.2]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.0.1...v1.0.2
[v1.0.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v1.0.0...v1.0.1
[v1.0.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.10...v1.0.0
[v0.2.10]:          https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.9...v0.2.10
[v0.2.9]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.8...v0.2.9
[v0.2.8]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.7...v0.2.8
[v0.2.7]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.6...v0.2.7
[v0.2.6]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.5...v0.2.6
[v0.2.5]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.4...v0.2.5
[v0.2.4]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.3...v0.2.4
[v0.2.3]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.2...v0.2.3
[v0.2.2]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.1...v0.2.2
[v0.2.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.2.0...v0.2.1
[v0.2.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.1.1...v0.2.0
[v0.1.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.1.0...v0.1.1
[v0.1.0]:           https://github.com/thoukydides/matterbridge-dyson-robot/releases/tag/v0.1.0
