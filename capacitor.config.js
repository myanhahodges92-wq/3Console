/*
 * 3CONSOLE ANDROID APPLICATION CONFIGURATION
 * -------------------------------------------
 * Native application configuration for the 3Console
 * Android shell.
 *
 * The existing 3Console web runtime remains the application.
 * Android provides the native application container.
 */

const config = {
  appId: "com.threeconsole.app",
  
  appName: "3Console",
  
  webDir: ".",
  
  server: {
    androidScheme: "https"
  },
  
  android: {
    backgroundColor: "#000000"
  }
};

export default config;