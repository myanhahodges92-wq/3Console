import PackageManager from "./packageManager.js";
import GameRuntime from "./gameRuntime.js";
import RuntimeManager from "./runtimeManager.js";
import SaveSystem from "./saveSystem.js";
import StorageManager from "./storageManager.js";
import InputManager from "./inputManager.js";

class ConsoleApp {
constructor() {
this.storage = null;
this.packageManager = null;
this.runtimeManager = null;
this.saveSystem = null;
this.inputManager = null;
this.gameRuntime = null;

    this.currentGame = null;

    this.elements = {};
    this.initialized = false;
}

async init() {
    if (this.initialized) {
        return;
    }

    this.cacheElements();

    this.storage = new StorageManager();
    await this.storage.init();

    this.packageManager =
        new PackageManager(this.storage);

    const initializedGames =
        await this.packageManager.init();

    if (Array.isArray(initializedGames)) {
        this.packageManager.games =
            initializedGames;
    } else {
        this.packageManager.games = [];
    }

    this.runtimeManager =
        new RuntimeManager();

    await this.runtimeManager.init();

    this.saveSystem =
        new SaveSystem(this.storage);

    this.inputManager =
        new InputManager();

    this.gameRuntime =
        new GameRuntime(
            this.runtimeManager,
            this.inputManager,
            this.saveSystem
        );

    this.bindEvents();

    await this.refreshLibrary();

    this.initialized = true;

    console.log(
        "3Console initialized successfully."
    );

    console.log(
        "Runtime:",
        this.runtimeManager.getVersion()
    );
}

cacheElements() {
    this.elements = {
        libraryScreen:
            document.getElementById(
                "library-screen"
            ),

        gameScreen:
            document.getElementById(
                "game-screen"
            ),

        gameLibrary:
            document.getElementById(
                "game-library"
            ),

        gameContainer:
            document.getElementById(
                "game-container"
            ),

        addGameButton:
            document.getElementById(
                "add-game-button"
            ),

        gameFileInput:
            document.getElementById(
                "game-file-input"
            ),

        gameBackButton:
            document.getElementById(
                "game-back-button"
            )
    };
}

bindEvents() {
    if (this.elements.addGameButton) {
        this.elements.addGameButton.addEventListener(
            "click",
            () => {
                this.openGameFilePicker();
            }
        );
    }

    if (this.elements.gameFileInput) {
        this.elements.gameFileInput.addEventListener(
            "change",
            event => {
                this.handleGameFile(
                    event
                );
            }
        );
    }

    if (this.elements.gameBackButton) {
        this.elements.gameBackButton.addEventListener(
            "click",
            () => {
                this.closeGame();
            }
        );
    }
}

openGameFilePicker() {
    if (!this.elements.gameFileInput) {
        return;
    }

    this.elements.gameFileInput.value = "";

    this.elements.gameFileInput.click();
}

async handleGameFile(event) {
    const files =
        event &&
        event.target &&
        event.target.files;

    if (!files || files.length === 0) {
        return;
    }

    const file = files[0];

    await this.installGame(file);
}

async installGame(file) {
    try {
        const game =
            await this.packageManager.installPackage(
                file
            );

        console.log(
            "3Console: game installed:",
            game
        );

        await this.refreshLibrary();

    } catch (error) {
        console.error(
            "3Console: game installation failed:",
            error
        );

        console.error(
            "Installation details:",
            this.formatError(error)
        );

        this.showError(
            "Game installation failed:\n\n" +
            this.formatError(error)
        );
    }
}

async refreshLibrary() {
    let games = [];

    try {
        const result =
            await this.packageManager.getInstalledGames();

        if (Array.isArray(result)) {
            games = result;
        } else {
            console.warn(
                "3Console: installed games was not an array. Resetting library."
            );

            games = [];

            this.packageManager.games = [];

            await this.storage.set(
                this.packageManager.storageKey,
                []
            );
        }

    } catch (error) {
        console.error(
            "3Console: failed to read installed games:",
            error
        );

        games = [];
    }

    this.renderLibrary(games);

    return games;
}

renderLibrary(games) {
    const library =
        this.elements.gameLibrary;

    if (!library) {
        return;
    }

    library.innerHTML = "";

    if (!Array.isArray(games) || games.length === 0) {
        const empty =
            document.createElement("div");

        empty.id = "empty-library";

        empty.innerHTML = `
            <h3>No Games Installed</h3>
            <p>Add a 3Console game package to get started.</p>
        `;

        library.appendChild(empty);

        return;
    }

    for (const game of games) {
        if (!game || typeof game !== "object") {
            continue;
        }

        this.renderGameCard(
            game,
            library
        );
    }
}

renderGameCard(game, library) {
    const card =
        document.createElement("article");

    card.className =
        "game-card";

    const name =
        document.createElement("h3");

    name.textContent =
        game.name ||
        "Untitled Game";

    const version =
        document.createElement("p");

    version.textContent =
        `Version ${
            game.version || "1.0.0"
        }`;

    const actions =
        document.createElement("div");

    actions.className =
        "game-card-actions";

    const playButton =
        document.createElement("button");

    playButton.type = "button";

    playButton.textContent =
        "Play";

    playButton.addEventListener(
        "click",
        () => {
            this.launchGame(
                game
            );
        }
    );

    const ejectButton =
        document.createElement("button");

    ejectButton.type = "button";

    ejectButton.textContent =
        "Eject";

    ejectButton.className =
        "game-eject-button";

    ejectButton.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            this.ejectGame(
                game
            );
        }
    );

    actions.appendChild(
        playButton
    );

    actions.appendChild(
        ejectButton
    );

    card.appendChild(name);
    card.appendChild(version);
    card.appendChild(actions);

    library.appendChild(card);
}

async ejectGame(game) {
    if (!game || !game.id) {
        this.showError(
            "Unable to eject game: game ID is missing."
        );

        return;
    }

    const gameName =
        game.name ||
        "this game";

    const confirmed =
        window.confirm(
            `Eject "${gameName}" from 3Console?`
        );

    if (!confirmed) {
        return;
    }

    try {
        if (
            this.currentGame &&
            this.currentGame.id === game.id
        ) {
            await this.closeGame();
        }

        await this.packageManager.removeGame(
            game.id
        );

        console.log(
            "3Console: game ejected:",
            game
        );

        await this.refreshLibrary();

    } catch (error) {
        console.error(
            "3Console: game eject failed:",
            error
        );

        console.error(
            "Eject details:",
            this.formatError(error)
        );

        this.showError(
            "Game eject failed:\n\n" +
            this.formatError(error)
        );
    }
}

async launchGame(game) {
    if (!game) {
        return;
    }

    if (!this.gameRuntime) {
        this.showError(
            "Game runtime is not initialized."
        );

        return;
    }

    try {
        this.currentGame = game;

        this.elements.libraryScreen.hidden =
            true;

        this.elements.gameScreen.hidden =
            false;

        await this.gameRuntime.launch(
            game,
            this.elements.gameContainer
        );

    } catch (error) {
        console.error(
            "3Console: game launch failed:",
            error
        );

        console.error(
            "Launch details:",
            this.formatError(error)
        );

        this.currentGame = null;

        this.elements.libraryScreen.hidden =
            false;

        this.elements.gameScreen.hidden =
            true;

        this.showError(
            "Game launch failed:\n\n" +
            this.formatError(error)
        );
    }
}

async closeGame() {
    try {
        if (this.gameRuntime) {
            await this.gameRuntime.stop();
        }
    } catch (error) {
        console.error(
            "3Console: error stopping game:",
            error
        );
    }

    this.currentGame = null;

    if (this.elements.gameContainer) {
        this.elements.gameContainer.innerHTML =
            "";
    }

    if (this.elements.gameScreen) {
        this.elements.gameScreen.hidden =
            true;
    }

    if (this.elements.libraryScreen) {
        this.elements.libraryScreen.hidden =
            false;
    }

    await this.refreshLibrary();
}

showError(message) {
    console.error(
        "3Console:",
        message
    );

    if (!this.elements.gameLibrary) {
        return;
    }

    let errorElement =
        document.getElementById(
            "console-error"
        );

    if (!errorElement) {
        errorElement =
            document.createElement("div");

        errorElement.id =
            "console-error";

        errorElement.style.whiteSpace =
            "pre-wrap";

        errorElement.style.padding =
            "12px";

        errorElement.style.margin =
            "12px 0";

        errorElement.style.border =
            "1px solid #555";

        errorElement.style.borderRadius =
            "8px";

        this.elements.gameLibrary.prepend(
            errorElement
        );
    }

    errorElement.textContent =
        message;
}

formatError(error) {
    if (!error) {
        return "Unknown error.";
    }

    if (error instanceof Error) {
        return (
            error.message ||
            error.toString()
        );
    }

    if (
        typeof error === "object"
    ) {
        try {
            return JSON.stringify(
                error,
                null,
                2
            );
        } catch {
            return String(error);
        }
    }

    return String(error);
}

async shutdown() {
    try {
        if (this.gameRuntime) {
            await this.gameRuntime.stop();
        }
    } catch (error) {
        console.error(
            "3Console: runtime shutdown error:",
            error
        );
    }

    try {
        if (this.runtimeManager) {
            await this.runtimeManager.shutdown();
        }
    } catch (error) {
        console.error(
            "3Console: runtime manager shutdown error:",
            error
        );
    }

    try {
        if (this.inputManager) {
            this.inputManager.detach();
        }
    } catch (error) {
        console.error(
            "3Console: input shutdown error:",
            error
        );
    }

    try {
        if (this.storage) {
            this.storage.close();
        }
    } catch (error) {
        console.error(
            "3Console: storage shutdown error:",
            error
        );
    }

    this.initialized = false;
}

}

const consoleApp =
new ConsoleApp();

window.addEventListener(
"DOMContentLoaded",
async () => {
try {
await consoleApp.init();

    } catch (error) {
        console.error(
            "3Console failed to initialize:",
            error
        );

        console.error(
            "3Console initialization details:",
            consoleApp.formatError(error)
        );

        console.error(
            "3Console startup terminated:",
            error
        );
    }
}

);

window.addEventListener(
"beforeunload",
() => {
consoleApp.shutdown();
}
);

export {
ConsoleApp,
consoleApp
};

export default ConsoleApp;