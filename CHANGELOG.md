# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

[Unreleased]:       https://github.com/thoukydides/matterbridge-dyson-robot/compare/v0.2.0...HEAD
[v0.2.0]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.1.1...v0.2.0
[v0.1.1]:           https://github.com/thoukydides/homebridge-homeconnect/compare/v0.1.0...v0.1.1
[v0.1.0]:           https://github.com/thoukydides/matterbridge-dyson-robot/releases/tag/v0.1.0
