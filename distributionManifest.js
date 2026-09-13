/*
 * 3CONSOLE DISTRIBUTION MANIFEST
 * --------------------------------
 * Defines the files that belong to the 3Console application.
 *
 * This is a distribution-layer file.
 * It does not initialize, modify, or run the 3Console runtime.
 *
 * The Android application shell will package these files
 * into the installed 3Console application.
 *
 * Three.js is a host-provided runtime dependency of 3Console.
 */

export const THREEBOX_DISTRIBUTION = {
  name: "3Console",
  version: "1.0.0",
  
  platform: {
    primary: "android",
    future: ["ios"]
  },
  
  application: {
    type: "web-runtime",
    entry: "index.html"
  },
  
  runtime: {
    name: "R86dev",
    provider: "3Console",
    bundled: true
  },
  
  files: [
    "index.html",
    "style.css",
    "manifest.json",
    
    "3Console.js",
    "gameRuntime.js",
    "inputManager.js",
    "packageManager.js",
    "r86devConverter.js",
    "runtimeManager.js",
    "saveSystem.js",
    "storageManager.js",
    "zipReader.js",
    
    /*
     * Host Three.js runtime files.
     *
     * These belong to the 3Console application and are not
     * part of individual game ZIP packages.
     */
    "cdn_modules/three.js@0.186.0/three.core.js",
    "cdn_modules/three.js@0.186.0/three.tsl.js",
    "cdn_modules/three.js@0.186.0/three.webgpu.min.js"
  ]
};

export function getDistributionFiles() {
  return [...THREEBOX_DISTRIBUTION.files];
}