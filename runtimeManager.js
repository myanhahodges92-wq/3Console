// runtimeManager.js

export class RuntimeManager {
    constructor() {
        this.runtimeVersion = "R86dev";

        this.runtime = null;

        this.initialized = false;
        this.available = false;
    }

    async init() {
        if (this.initialized) {
            return this.runtime;
        }

        /*
         * 3Console owns the R86dev runtime.
         *
         * The runtime is host-provided. Games do not
         * need to package their own Three.js files.
         */
        this.runtime = {
            version: this.runtimeVersion,
            available: true,
            type: "Three.js",
            renderer: "R86dev"
        };

        this.available = true;
        this.initialized = true;

        console.log(
            "3Console RuntimeManager initialized:",
            this.runtimeVersion
        );

        return this.runtime;
    }

    ensureAvailable() {
        if (
            !this.initialized ||
            !this.runtime ||
            !this.available
        ) {
            throw new Error(
                "3Console runtime manager is not available."
            );
        }

        return true;
    }

    registerRuntime(runtime) {
        if (!runtime) {
            throw new Error(
                "Cannot register an empty runtime."
            );
        }

        this.runtime = {
            ...runtime,

            version:
                runtime.version ||
                this.runtimeVersion,

            available: true
        };

        this.available = true;
        this.initialized = true;

        return this.runtime;
    }

    getRuntime() {
        this.ensureAvailable();

        return this.runtime;
    }

    getVersion() {
        return this.runtimeVersion;
    }

    isAvailable() {
        return (
            this.initialized &&
            this.available &&
            !!this.runtime
        );
    }

    async shutdown() {
        this.runtime = null;
        this.available = false;
        this.initialized = false;
    }
}

export default RuntimeManager;