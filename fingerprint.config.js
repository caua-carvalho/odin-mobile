/**
 * Fingerprint runtime configuration (expo-updates / EAS Update).
 *
 * The runtime version is derived from the project's native fingerprint. Skipping
 * metadata that does not change the native binary keeps OTA updates working
 * across docs, npm scripts and EAS config edits. Native changes (dependencies,
 * config plugins, package name, icons, prebuild output) still change the
 * fingerprint and require a new APK.
 *
 * @type {import('@expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: [
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'ExpoConfigNames',
    'ExpoConfigEASProject',
    'PackageJsonScriptsAll',
    'GitIgnore',
    'EasJson',
    'Easignore',
  ],
}
