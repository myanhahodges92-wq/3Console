/*
 * 3CONSOLE DISTRIBUTION MANIFEST
 * --------------------------------
 * Defines the files that belong to the downloadable 3Console package.
 *
 * This is a distribution-layer file.
 * It does not initialize or modify the 3Console runtime.
 *
 * Three.js is included because it is part of the local 3Console runtime.
 */

export const THREEBOX_DISTRIBUTION = {
  name: "3Console",
  version: "1.0.0",
  directory: "3Console",
  
  files: [
    "index.html",
    "Style.css",
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
    
    "cdn_modules/three.js@0.186.0/three.core.js",
    "cdn_modules/three.js@0.186.0/three.tsl.js",
    "cdn_modules/three.js@0.186.0/three.webgpu.min.js"
  ]
};

export function getDistributionFiles() {
  return [...THREEBOX_DISTRIBUTION.files];
}