# Changelog

All notable changes to Gauntlet Dev Tools will be documented in this file.

For changes in main application see [separate CHANGELOG.md](https://github.com/project-gauntlet/gauntlet/blob/main/CHANGELOG.md)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning Convention

## [0.7.0] - 2024-09-15
- Add `permissions.clipboard` manifest property that accepts list of one or more of `"read"`, `"write"` and `"clear"` values
- Add `permissions.main_search_bar` manifest property that accepts list with `"read"` value
- **BREAKING CHANGE**: `preferences.name` manifest property is split into `preferences.name` and `preferences.id`
- **BREAKING CHANGE**: `entrypoint.preferences.name` manifest property is split into `entrypoint.preferences.name` and `entrypoint.preferences.id`

## [0.6.0] - 2024-08-04

- Make `dev` server pretty
- `dev` server how displays stdout `console.log` and stderr `console.error` of monitored plugin
- Properly handle a lot of various possible errors in `build` and `dev` commands 
- Added `windows` and `macos` values to plugins manifest `supported_system` property
- **BREAKING CHANGE**: `dist` suffix is no longer automatically added to plugin ID. Please update main `Gauntlet` application to `v6`
- `dist` directory is now automatically cleaned before building plugin
- Fix `publish` failing when `current-version` tag already exists

## [0.5.0] - 2024-04-30

- `publish` CLI command how properly publishes to `gauntlet/release` instead of `release` branch
- Fix `publish` CLI command failing if `assets` directory doesn't exist
- Fix `assets` directory not being published

## [0.4.0] - 2024-04-29

- **BREAKING CHANGE**: Migrate from DBus to gRPC to allow for easier cross-platform
- Add support for entrypoint action description field `entrypoint.*.actions.*.description` in plugin manifest
- Add support for entrypoint action shortcuts field `entrypoint.*.actions.*.shortcut` in plugin manifest
- Add support for assets
- Add support for `inline-view` entrypoint type 
- Add support for `command-generator` entrypoint type 
- Add support for plugin and entrypoint preferences fields `preferences` and `entrypoint.*.preferences` in plugin manifest
- Add support for `gauntlet.description` and `entrypoint.*.description` fields
  - **BREAKING CHANGE**: These fields are now required
- Dev server now detects changes in plugin manifest  
- **BREAKING CHANGE**: `entrypoint.*.id` is now required to match `^[a-z0-9-]+$` regex. Non-empty string with only small letters and numbers

## [0.3.0] - 2024-01-29

- Fix manifest not being copied to `dist` directory when running dev server

## [0.2.0] - 2024-01-29

- Initial release

