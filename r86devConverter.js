class R86Converter {
    constructor(options = {}) {
        this.runtimePath =
            options.runtimePath || "3console://runtime/r86dev/";
    }
    
    convertFile(path, data) {
        if (!path || !(data instanceof Uint8Array)) {
            return {
                path,
                data,
                changed: false
            };
        }
        
        const lowerPath = String(path).toLowerCase();
        
        if (
            !lowerPath.endsWith(".html") &&
            !lowerPath.endsWith(".js") &&
            !lowerPath.endsWith(".mjs")
        ) {
            return {
                path,
                data,
                changed: false
            };
        }
        
        const text = new TextDecoder().decode(data);
        
        const converted = this.convertText(text);
        
        if (converted === text) {
            return {
                path,
                data,
                changed: false
            };
        }
        
        return {
            path,
            data: new TextEncoder().encode(converted),
            changed: true
        };
    }
    
    convertText(text) {
        if (typeof text !== "string" || !text.length) {
            return text;
        }
        
        let result = text;
        
        /*
         * Convert common local Three.js references to the
         * console runtime namespace.
         *
         * The original game package is never modified.
         */
        
        result = result.replace(
            /(["'`])(?:\.\/|\.\.\/)*three(?:\.min)?\.js\1/gi,
            `$1${this.runtimePath}three.js$1`
        );
        
        result = result.replace(
            /(["'`])(?:\.\/|\.\.\/)*three\.module\.js\1/gi,
            `$1${this.runtimePath}three.js$1`
        );
        
        result = result.replace(
            /(["'`])(?:\.\/|\.\.\/)*three\.core(?:\.min)?\.js\1/gi,
            `$1${this.runtimePath}three.js$1`
        );
        
        result = result.replace(
            /(["'`])(?:\.\/|\.\.\/)*three\.webgpu(?:\.min)?\.js\1/gi,
            `$1${this.runtimePath}three.js$1`
        );
        
        return result;
    }
    
    isThreeReference(path) {
        if (!path) {
            return false;
        }
        
        const normalized = String(path)
            .replace(/\\/g, "/")
            .toLowerCase();
        
        const filename =
            normalized.split("/").pop();
        
        return (
            filename === "three.js" ||
            filename === "three.min.js" ||
            filename === "three.module.js" ||
            filename === "three.core.js" ||
            filename === "three.core.min.js" ||
            filename === "three.webgpu.js" ||
            filename === "three.webgpu.min.js"
        );
    }
    
    getRuntimePath() {
        return this.runtimePath;
    }
}

export { R86Converter };
export default R86Converter;