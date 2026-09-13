const HOST_THREE_ROOT =
new URL(
"./cdn_modules/three.js@0.186.0/",
window.location.href
).href;

const HOST_THREE_CORE =
HOST_THREE_ROOT + "three.core.js";

const HOST_THREE_TSL =
HOST_THREE_ROOT + "three.tsl.js";

const HOST_THREE_WEBGPU =
HOST_THREE_ROOT + "three.webgpu.min.js";

class GameRuntime {

constructor(runtimeManager, inputManager, saveSystem) {
    this.runtimeManager = runtimeManager;
    this.inputManager = inputManager;
    this.saveSystem = saveSystem;

    this.currentGame = null;
    this.container = null;
    this.iframe = null;
    this.running = false;

    this.files = new Map();
    this.gameFileUrls = new Map();
    this.objectUrls = [];

    this.resizeHandler = null;
    this.resizeObserver = null;
}


async launch(game, container) {

    if (!game) {
        throw new Error(
            "3Console cannot launch an empty game."
        );
    }

    if (!container) {
        throw new Error(
            "3Console game container is missing."
        );
    }

    if (
        this.runtimeManager &&
        typeof this.runtimeManager.isAvailable === "function" &&
        !this.runtimeManager.isAvailable()
    ) {
        throw new Error(
            "3Console runtime manager is not available."
        );
    }

    if (!Array.isArray(game.files)) {
        throw new Error(
            "Game package contains no valid files."
        );
    }

    if (this.running) {
        await this.stop();
    }

    this.currentGame = game;
    this.container = container;

    console.log(
        "3Console launching game:",
        game.name
    );

    console.log(
        "3Console runtime:",
        this.runtimeManager?.getVersion?.() || "R86dev"
    );

    this.prepareContainer();

    this.buildFileSystem(game.files);
    this.createFileUrls();

    const entry = this.getEntryHtml(game.entry);

    const preparedHtml =
        this.prepareGameHtml(
            entry,
            game.entry
        );

    const iframe =
        document.createElement("iframe");

    iframe.title =
        game.name || "3Console Game";

    iframe.setAttribute(
        "allow",
        "autoplay; fullscreen; gamepad"
    );

    iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms allow-pointer-lock"
    );

    iframe.style.position = "absolute";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.minWidth = "0";
    iframe.style.minHeight = "0";
    iframe.style.border = "0";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.style.display = "block";
    iframe.style.background = "#000";

    this.iframe = iframe;

    this.setupResizeHandling();

    this.container.appendChild(iframe);

    iframe.srcdoc = preparedHtml;

    this.resizeGameViewport();

    this.running = true;

    if (
        this.inputManager &&
        typeof this.inputManager.attach === "function"
    ) {
        try {
            this.inputManager.attach(iframe);
        } catch (error) {
            console.warn(
                "3Console input attachment warning:",
                error
            );
        }
    }

    return iframe;
}


prepareContainer() {

    this.container.innerHTML = "";

    this.container.style.position = "relative";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.minHeight = "calc(100vh - 70px)";
    this.container.style.minWidth = "0";
    this.container.style.overflow = "hidden";
    this.container.style.display = "block";
    this.container.style.background = "#000";
}


setupResizeHandling() {

    this.resizeHandler = () => {
        this.resizeGameViewport();
    };

    window.addEventListener(
        "resize",
        this.resizeHandler
    );

    window.addEventListener(
        "orientationchange",
        this.resizeHandler
    );

    if (
        typeof ResizeObserver !== "undefined"
    ) {
        this.resizeObserver =
            new ResizeObserver(() => {
                this.resizeGameViewport();
            });

        this.resizeObserver.observe(
            this.container
        );
    }
}


resizeGameViewport() {

    if (
        !this.container ||
        !this.iframe
    ) {
        return;
    }

    const rect =
        this.container.getBoundingClientRect();

    const width =
        Math.max(
            1,
            Math.floor(rect.width)
        );

    const height =
        Math.max(
            1,
            Math.floor(rect.height)
        );

    this.iframe.style.width =
        width + "px";

    this.iframe.style.height =
        height + "px";

    try {
        this.iframe.contentWindow?.dispatchEvent(
            new Event("resize")
        );
    } catch (error) {
        // Game document may not be ready yet.
    }
}


buildFileSystem(files) {

    this.files.clear();

    for (const file of files) {

        if (
            !file ||
            !file.path
        ) {
            continue;
        }

        const path =
            this.normalizePath(
                file.path
            );

        this.files.set(
            path,
            file.data
        );
    }
}


createFileUrls() {

    this.revokeObjectUrls();

    this.gameFileUrls.clear();

    /*
     * Create URLs for non-JavaScript resources.
     */
    for (
        const [path, data]
        of this.files
    ) {

        if (
            this.isJavaScript(path)
        ) {
            continue;
        }

        const blob =
            this.createBlob(
                data,
                this.getMimeType(path)
            );

        const url =
            URL.createObjectURL(blob);

        this.objectUrls.push(url);

        this.gameFileUrls.set(
            path,
            url
        );
    }

    /*
     * Initial JavaScript URLs.
     */
    const initialUrls =
        new Map(
            this.gameFileUrls
        );

    for (
        const [path, data]
        of this.files
    ) {

        if (
            !this.isJavaScript(path)
        ) {
            continue;
        }

        const source =
            this.decodeText(data);

        const rewritten =
            this.rewriteJavaScript(
                source,
                path,
                initialUrls
            );

        const blob =
            new Blob(
                [rewritten],
                {
                    type: "text/javascript"
                }
            );

        const url =
            URL.createObjectURL(blob);

        this.objectUrls.push(url);

        this.gameFileUrls.set(
            path,
            url
        );
    }

    /*
     * Resolve package module chains.
     */
    for (
        let pass = 0;
        pass < 8;
        pass++
    ) {

        const previousUrls =
            new Map(
                this.gameFileUrls
            );

        for (
            const [path, data]
            of this.files
        ) {

            if (
                !this.isJavaScript(path)
            ) {
                continue;
            }

            const source =
                this.decodeText(data);

            const rewritten =
                this.rewriteJavaScript(
                    source,
                    path,
                    previousUrls
                );

            const blob =
                new Blob(
                    [rewritten],
                    {
                        type: "text/javascript"
                    }
                );

            const url =
                URL.createObjectURL(blob);

            this.objectUrls.push(url);

            this.gameFileUrls.set(
                path,
                url
            );
        }
    }
}


getEntryHtml(entry) {

    const normalized =
        this.normalizePath(
            entry || "index.html"
        );

    const data =
        this.files.get(normalized);

    if (
        data === undefined
    ) {
        throw new Error(
            "Game entry file not found: " +
            normalized
        );
    }

    return this.decodeText(data);
}


prepareGameHtml(html, entryPath) {

    let result = html;

    result =
        this.rewriteHtmlResources(
            result,
            entryPath
        );

    result =
        this.rewriteInlineCss(
            result,
            entryPath
        );

    result =
        this.rewriteInlineModuleScripts(
            result,
            entryPath
        );

    result =
        this.injectHostImportMap(
            result
        );

    return result;
}


injectHostImportMap(html) {

    let existingImports = {};

    const pattern =
        /<script([^>]*)type\s*=\s*["']importmap["']([^>]*)>([\s\S]*?)<\/script>/i;

    const match =
        html.match(pattern);

    if (match) {

        try {

            const existing =
                JSON.parse(
                    match[3].trim()
                );

            if (
                existing &&
                typeof existing.imports === "object"
            ) {
                existingImports =
                    {
                        ...existing.imports
                    };
            }

        } catch (error) {

            console.warn(
                "3Console replacing invalid game import map."
            );
        }
    }

    /*
     * Host-owned Three.js mappings.
     */
    existingImports["three"] =
        HOST_THREE_CORE;

    existingImports["three/webgpu"] =
        HOST_THREE_WEBGPU;

    existingImports["three/tsl"] =
        HOST_THREE_TSL;

    existingImports["./Three.webgpu.min.js"] =
        HOST_THREE_WEBGPU;

    existingImports["./Three.webgpu.js"] =
        HOST_THREE_WEBGPU;

    existingImports["./Three.core.js"] =
        HOST_THREE_CORE;

    existingImports["./three.core.js"] =
        HOST_THREE_CORE;

    existingImports["./Three.tsl.js"] =
        HOST_THREE_TSL;

    existingImports["./three.tsl.js"] =
        HOST_THREE_TSL;

    const mapObject = {
        imports: existingImports
    };

    const mapText =
        JSON.stringify(
            mapObject,
            null,
            4
        );

    const mapScript =
        '<script type="importmap">\n' +
        mapText +
        '\n</script>';

    if (match) {
        return html.replace(
            pattern,
            mapScript
        );
    }

    if (
        /<head[\s>]/i.test(html)
    ) {
        return html.replace(
            /<head([^>]*)>/i,
            '<head$1>' +
            mapScript
        );
    }

    return (
        mapScript +
        html
    );
}


rewriteHtmlResources(
    html,
    entryPath
) {

    const attributes = [
        "src",
        "href",
        "poster",
        "data"
    ];

    let result = html;

    for (
        const attribute
        of attributes
    ) {

        const pattern =
            new RegExp(
                "(" +
                attribute +
                "\\s*=\\s*)" +
                "([\"'])" +
                "([^\"']+)" +
                "\\2",
                "gi"
            );

        result =
            result.replace(
                pattern,
                (
                    full,
                    prefix,
                    quote,
                    value
                ) => {

                    if (
                        this.isHostThreeReference(
                            value
                        )
                    ) {

                        return (
                            prefix +
                            quote +
                            this.resolveHostThreeFile(
                                value
                            ) +
                            quote
                        );
                    }

                    const resolved =
                        this.resolvePackageResource(
                            value,
                            entryPath
                        );

                    if (!resolved) {
                        return full;
                    }

                    return (
                        prefix +
                        quote +
                        resolved +
                        quote
                    );
                }
            );
    }

    return result;
}


rewriteInlineCss(
    html,
    entryPath
) {

    return html.replace(
        /url\s*(["']?)([^)"']+)\1\s*/gi,
        (
            full,
            quote,
            value
        ) => {

            const resolved =
                this.resolvePackageResource(
                    value,
                    entryPath
                );

            if (!resolved) {
                return full;
            }

            return (
                'url("' +
                resolved +
                '")'
            );
        }
    );
}


rewriteInlineModuleScripts(
    html,
    entryPath
) {

    return html.replace(
        /<script([^>]*)type\s*=\s*["']module["']([^>]*)>([\s\S]*?)<\/script>/gi,
        (
            full,
            before,
            after,
            source
        ) => {

            /*
             * External module scripts have their src
             * handled by rewriteHtmlResources().
             */
            if (
                /\bsrc\s*=/i.test(
                    before + after
                )
            ) {
                return full;
            }

            const rewritten =
                this.rewriteJavaScript(
                    source,
                    entryPath,
                    this.gameFileUrls
                );

            return (
                "<script" +
                before +
                'type="module"' +
                after +
                ">" +
                rewritten +
                "</script>"
            );
        }
    );
}


rewriteJavaScript(
    source,
    currentPath,
    urlMap
) {

    let result = source;

    /*
     * Handles:
     *
     * import X from "./file.js"
     * import "./file.js"
     * export X from "./file.js"
     * import("./file.js")
     */
    result =
        result.replace(
            /(\bfrom\s*|\bimport\s+(?!\()|\bimport\s*\(\s*)(["'])([^"']+)\2/g,
            (
                full,
                prefix,
                quote,
                specifier
            ) => {

                if (
                    this.isThreeSpecifier(
                        specifier
                    )
                ) {

                    return (
                        prefix +
                        quote +
                        this.resolveThreeSpecifier(
                            specifier
                        ) +
                        quote
                    );
                }

                if (
                    this.isThreeFileReference(
                        specifier
                    )
                ) {

                    return (
                        prefix +
                        quote +
                        HOST_THREE_WEBGPU +
                        quote
                    );
                }

                if (
                    isRelativeImport(
                        specifier
                    )
                ) {

                    const resolved =
                        this.resolvePackageModule(
                            currentPath,
                            specifier,
                            urlMap
                        );

                    if (resolved) {

                        return (
                            prefix +
                            quote +
                            resolved +
                            quote
                        );
                    }

                    console.warn(
                        "3Console unresolved game import:",
                        currentPath,
                        "->",
                        specifier
                    );

                    return full;
                }

                return full;
            }
        );

    /*
     * Catch remaining direct Three filename strings.
     */
    result =
        result
            .replace(
                /(["'])(?:\.\/)?Three\.webgpu\.min\.js\1/gi,
                '"' +
                HOST_THREE_WEBGPU +
                '"'
            )
            .replace(
                /(["'])(?:\.\/)?Three\.webgpu\.js\1/gi,
                '"' +
                HOST_THREE_WEBGPU +
                '"'
            )
            .replace(
                /(["'])(?:\.\/)?Three\.core\.js\1/gi,
                '"' +
                HOST_THREE_CORE +
                '"'
            )
            .replace(
                /(["'])(?:\.\/)?three\.core\.js\1/gi,
                '"' +
                HOST_THREE_CORE +
                '"'
            )
            .replace(
                /(["'])(?:\.\/)?Three\.tsl\.js\1/gi,
                '"' +
                HOST_THREE_TSL +
                '"'
            )
            .replace(
                /(["'])(?:\.\/)?three\.tsl\.js\1/gi,
                '"' +
                HOST_THREE_TSL +
                '"'
            );

    return result;
}


resolvePackageModule(
    currentPath,
    specifier,
    urlMap
) {

    const resolvedPath =
        this.resolvePackagePath(
            currentPath,
            specifier
        );

    if (!resolvedPath) {
        return null;
    }

    return (
        urlMap.get(resolvedPath) ||
        this.gameFileUrls.get(resolvedPath) ||
        null
    );
}


resolvePackagePath(
    currentPath,
    specifier
) {

    const directory =
        currentPath.includes("/")
            ? currentPath.slice(
                0,
                currentPath.lastIndexOf("/") + 1
            )
            : "";

    const target =
        this.normalizePath(
            directory +
            specifier
        );

    /*
     * Exact path first.
     */
    if (
        this.files.has(target)
    ) {
        return target;
    }

    /*
     * Case-insensitive fallback.
     *
     * This handles:
     * ./World.js -> world.js
     * ./Enemy.js -> enemy.js
     * ./EnemyAI.js -> enemyAI.js
     * ./Combat.js -> combat.js
     */
    const lowerTarget =
        target.toLowerCase();

    for (
        const path
        of this.files.keys()
    ) {

        if (
            path.toLowerCase() ===
            lowerTarget
        ) {
            return path;
        }
    }

    /*
     * Extension fallback.
     */
    const candidates = [
        target + ".js",
        target + ".mjs"
    ];

    for (
        const candidate
        of candidates
    ) {

        if (
            this.files.has(candidate)
        ) {
            return candidate;
        }

        const lowerCandidate =
            candidate.toLowerCase();

        for (
            const path
            of this.files.keys()
        ) {

            if (
                path.toLowerCase() ===
                lowerCandidate
            ) {
                return path;
            }
        }
    }

    return null;
}


resolvePackageResource(
    value,
    currentPath
) {

    if (!value) {
        return null;
    }

    const trimmed =
        value.trim();

    if (
        trimmed.startsWith("#") ||
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("http:") ||
        trimmed.startsWith("https:") ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("mailto:") ||
        trimmed.startsWith("javascript:")
    ) {
        return null;
    }

    if (
        this.isHostThreeReference(
            trimmed
        )
    ) {

        return this.resolveHostThreeFile(
            trimmed
        );
    }

    const clean =
        trimmed
            .split("#")[0]
            .split("?")[0];

    const resolvedPath =
        this.resolvePackagePath(
            currentPath,
            clean
        );

    if (!resolvedPath) {
        return null;
    }

    return (
        this.gameFileUrls.get(
            resolvedPath
        ) ||
        null
    );
}


isHostThreeReference(value) {

    const normalized =
        String(value || "")
            .replace(/\\/g, "/")
            .toLowerCase();

    return (
        normalized.endsWith(
            "three.webgpu.min.js"
        ) ||
        normalized.endsWith(
            "three.webgpu.js"
        ) ||
        normalized.endsWith(
            "three.core.js"
        ) ||
        normalized.endsWith(
            "three.tsl.js"
        )
    );
}


isThreeFileReference(
    specifier
) {

    const normalized =
        String(specifier || "")
            .replace(/\\/g, "/")
            .toLowerCase();

    return (
        normalized.endsWith(
            "/three.webgpu.min.js"
        ) ||
        normalized ===
            "three.webgpu.min.js" ||
        normalized.endsWith(
            "/three.webgpu.js"
        ) ||
        normalized ===
            "three.webgpu.js" ||
        normalized.endsWith(
            "/three.core.js"
        ) ||
        normalized ===
            "three.core.js" ||
        normalized.endsWith(
            "/three.tsl.js"
        ) ||
        normalized ===
            "three.tsl.js"
    );
}


resolveHostThreeFile(value) {

    const normalized =
        String(value || "")
            .replace(/\\/g, "/")
            .toLowerCase();

    if (
        normalized.endsWith(
            "three.core.js"
        )
    ) {
        return HOST_THREE_CORE;
    }

    if (
        normalized.endsWith(
            "three.tsl.js"
        )
    ) {
        return HOST_THREE_TSL;
    }

    return HOST_THREE_WEBGPU;
}


isThreeSpecifier(specifier) {

    return (
        specifier === "three" ||
        specifier === "three/webgpu" ||
        specifier === "three/tsl"
    );
}


resolveThreeSpecifier(specifier) {

    if (
        specifier === "three"
    ) {
        return HOST_THREE_CORE;
    }

    if (
        specifier === "three/webgpu"
    ) {
        return HOST_THREE_WEBGPU;
    }

    if (
        specifier === "three/tsl"
    ) {
        return HOST_THREE_TSL;
    }

    return specifier;
}


normalizePath(path) {

    const value =
        String(path || "")
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

    const parts = [];

    for (
        const part
        of value.split("/")
    ) {

        if (
            !part ||
            part === "."
        ) {
            continue;
        }

        if (
            part === ".."
        ) {

            if (
                parts.length
            ) {
                parts.pop();
            }

            continue;
        }

        parts.push(part);
    }

    return parts.join("/");
}


isJavaScript(path) {

    return /\.(js|mjs)$/i.test(
        path
    );
}


createBlob(
    data,
    mimeType
) {

    if (
        data instanceof Blob
    ) {
        return new Blob(
            [data],
            {
                type: mimeType
            }
        );
    }

    if (
        data instanceof ArrayBuffer
    ) {
        return new Blob(
            [
                new Uint8Array(data)
            ],
            {
                type: mimeType
            }
        );
    }

    if (
        ArrayBuffer.isView(data)
    ) {
        return new Blob(
            [data],
            {
                type: mimeType
            }
        );
    }

    return new Blob(
        [
            String(data ?? "")
        ],
        {
            type: mimeType
        }
    );
}


decodeText(data) {

    if (
        typeof data === "string"
    ) {
        return data;
    }

    if (
        data instanceof ArrayBuffer
    ) {
        return new TextDecoder().decode(
            new Uint8Array(data)
        );
    }

    if (
        ArrayBuffer.isView(data)
    ) {
        return new TextDecoder().decode(
            new Uint8Array(
                data.buffer,
                data.byteOffset,
                data.byteLength
            )
        );
    }

    return String(
        data ?? ""
    );
}


getMimeType(path) {

    const lower =
        path.toLowerCase();

    if (
        lower.endsWith(".js") ||
        lower.endsWith(".mjs")
    ) {
        return "text/javascript";
    }

    if (
        lower.endsWith(".css")
    ) {
        return "text/css";
    }

    if (
        lower.endsWith(".html")
    ) {
        return "text/html";
    }

    if (
        lower.endsWith(".json")
    ) {
        return "application/json";
    }

    if (
        lower.endsWith(".glb")
    ) {
        return "model/gltf-binary";
    }

    if (
        lower.endsWith(".gltf")
    ) {
        return "model/gltf+json";
    }

    if (
        lower.endsWith(".bin")
    ) {
        return "application/octet-stream";
    }

    if (
        lower.endsWith(".wasm")
    ) {
        return "application/wasm";
    }

    if (
        lower.endsWith(".png")
    ) {
        return "image/png";
    }

    if (
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg")
    ) {
        return "image/jpeg";
    }

    if (
        lower.endsWith(".webp")
    ) {
        return "image/webp";
    }

    if (
        lower.endsWith(".gif")
    ) {
        return "image/gif";
    }

    if (
        lower.endsWith(".svg")
    ) {
        return "image/svg+xml";
    }

    if (
        lower.endsWith(".mp3")
    ) {
        return "audio/mpeg";
    }

    if (
        lower.endsWith(".wav")
    ) {
        return "audio/wav";
    }

    if (
        lower.endsWith(".ogg")
    ) {
        return "audio/ogg";
    }

    if (
        lower.endsWith(".mp4")
    ) {
        return "video/mp4";
    }

    if (
        lower.endsWith(".webm")
    ) {
        return "video/webm";
    }

    if (
        lower.endsWith(".txt")
    ) {
        return "text/plain";
    }

    return "application/octet-stream";
}


async stop() {

    if (
        this.inputManager &&
        typeof this.inputManager.detach === "function"
    ) {

        try {
            this.inputManager.detach();
        } catch (error) {
            console.warn(
                "3Console input detach warning:",
                error
            );
        }
    }

    if (
        this.resizeObserver
    ) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
    }

    if (
        this.resizeHandler
    ) {

        window.removeEventListener(
            "resize",
            this.resizeHandler
        );

        window.removeEventListener(
            "orientationchange",
            this.resizeHandler
        );

        this.resizeHandler = null;
    }

    if (
        this.iframe
    ) {

        this.iframe.srcdoc = "";

        this.iframe.remove();

        this.iframe = null;
    }

    this.revokeObjectUrls();

    this.files.clear();
    this.gameFileUrls.clear();

    if (
        this.container
    ) {
        this.container.innerHTML = "";
    }

    this.currentGame = null;
    this.container = null;
    this.running = false;
}


revokeObjectUrls() {

    for (
        const url
        of this.objectUrls
    ) {

        try {
            URL.revokeObjectURL(url);
        } catch (error) {
            // Ignore cleanup errors.
        }
    }

    this.objectUrls = [];
}


async shutdown() {
    await this.stop();
}


isRunning() {
    return this.running;
}


getCurrentGame() {
    return this.currentGame;
}

}

function isRelativeImport(specifier) {

return (
    specifier.startsWith("./") ||
    specifier.startsWith("../")
);

}

export {
GameRuntime
};

export default GameRuntime;