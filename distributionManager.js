/*
 * 3CONSOLE DISTRIBUTION MANAGER
 * -----------------------------
 * Distribution-layer controller for 3Console.
 *
 * This layer prepares 3Console for application packaging.
 *
 * It does NOT initialize or modify the 3Console runtime.
 * It does NOT run games.
 * It does NOT modify game ZIP packages.
 *
 * Android is the primary distribution target.
 * iOS can be added later using the same application definition.
 */

import {
    THREEBOX_DISTRIBUTION,
    getDistributionFiles
} from "./distributionManifest.js";


const APPLICATION_NAME = "3Console";
const APPLICATION_VERSION = "1.0.0";

const DISTRIBUTION_TARGETS = {
    android: {
        platform: "android",
        packageType: "apk",
        entry: "index.html"
    },

    ios: {
        platform: "ios",
        packageType: "ios-app",
        entry: "index.html"
    }
};


/*
 * Validate the distribution manifest before a build is attempted.
 */
function validateDistribution() {
    if (!THREEBOX_DISTRIBUTION) {
        throw new Error(
            "3Console distribution manifest is missing."
        );
    }

    if (
        !THREEBOX_DISTRIBUTION.name ||
        !THREEBOX_DISTRIBUTION.version
    ) {
        throw new Error(
            "3Console distribution manifest is missing name or version."
        );
    }

    const files = getDistributionFiles();

    if (!Array.isArray(files) || files.length === 0) {
        throw new Error(
            "3Console distribution manifest contains no files."
        );
    }

    return files;
}


/*
 * Return the files that belong inside the application.
 *
 * No file contents are changed.
 * Paths remain exactly as defined by the distribution manifest.
 */
export function getApplicationFiles() {
    return validateDistribution().map(path => ({
        path,
        source: path
    }));
}


/*
 * Return the application metadata required by a platform builder.
 */
export function getApplicationDefinition(
    platform = "android"
) {
    validateDistribution();

    const target = DISTRIBUTION_TARGETS[platform];

    if (!target) {
        throw new Error(
            `Unsupported 3Console distribution target: ${platform}`
        );
    }

    return {
        name: APPLICATION_NAME,
        version: APPLICATION_VERSION,

        platform: target.platform,
        packageType: target.packageType,

        entry: target.entry,

        runtime: {
            name: THREEBOX_DISTRIBUTION.runtime?.name || "R86dev",
            bundled:
                THREEBOX_DISTRIBUTION.runtime?.bundled === true
        },

        files: getApplicationFiles()
    };
}


/*
 * Android application definition.
 *
 * This is the primary target for Phase 1.
 */
export function getAndroidApplication() {
    return getApplicationDefinition("android");
}


/*
 * iOS application definition.
 *
 * The definition is prepared now so the core distribution
 * architecture does not need to be redesigned later.
 *
 * Actual iOS signing/building is handled outside this layer.
 */
export function getIOSApplication() {
    return getApplicationDefinition("ios");
}


/*
 * Return all supported distribution targets.
 */
export function getDistributionTargets() {
    return Object.keys(DISTRIBUTION_TARGETS);
}


/*
 * Return a complete distribution summary.
 *
 * Useful for the Android build layer and diagnostics.
 */
export function getDistributionInfo() {
    const files = validateDistribution();

    return {
        name: APPLICATION_NAME,
        version: APPLICATION_VERSION,

        primaryPlatform: "android",

        runtime: {
            name:
                THREEBOX_DISTRIBUTION.runtime?.name ||
                "R86dev",

            bundled:
                THREEBOX_DISTRIBUTION.runtime?.bundled === true
        },

        entry:
            THREEBOX_DISTRIBUTION.application?.entry ||
            "index.html",

        fileCount: files.length,

        targets: getDistributionTargets()
    };
}


export default {
    getApplicationFiles,
    getApplicationDefinition,
    getAndroidApplication,
    getIOSApplication,
    getDistributionTargets,
    getDistributionInfo
};