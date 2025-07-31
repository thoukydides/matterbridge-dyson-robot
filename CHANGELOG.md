# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

Copyright © 2025 Alexander Thoukydides

[Unreleased]:       https://github.com/thoukydides/matterbridge-dyson-robot/compare/v1.1.1...HEAD
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
