class InputManager {
    constructor() {
        this.target = null;
        this.attached = false;

        this.keys = new Set();
        this.buttons = new Set();
        this.pointers = new Map();
        this.gamepads = new Map();

        this.listeners = new Map();

        this.boundHandlers = {
            keydown: event => this.handleKeyDown(event),
            keyup: event => this.handleKeyUp(event),
            pointerdown: event => this.handlePointerDown(event),
            pointerup: event => this.handlePointerUp(event),
            pointercancel: event => this.handlePointerUp(event),
            pointermove: event => this.handlePointerMove(event),
            gamepadconnected: event => this.handleGamepadConnected(event),
            gamepaddisconnected: event => this.handleGamepadDisconnected(event)
        };
    }

    attach(target = document) {
        if (this.attached) {
            this.detach();
        }

        this.target = target;

        window.addEventListener(
            "keydown",
            this.boundHandlers.keydown
        );

        window.addEventListener(
            "keyup",
            this.boundHandlers.keyup
        );

        this.target.addEventListener(
            "pointerdown",
            this.boundHandlers.pointerdown
        );

        this.target.addEventListener(
            "pointerup",
            this.boundHandlers.pointerup
        );

        this.target.addEventListener(
            "pointercancel",
            this.boundHandlers.pointercancel
        );

        this.target.addEventListener(
            "pointermove",
            this.boundHandlers.pointermove
        );

        window.addEventListener(
            "gamepadconnected",
            this.boundHandlers.gamepadconnected
        );

        window.addEventListener(
            "gamepaddisconnected",
            this.boundHandlers.gamepaddisconnected
        );

        this.attached = true;

        return this;
    }

    detach() {
        window.removeEventListener(
            "keydown",
            this.boundHandlers.keydown
        );

        window.removeEventListener(
            "keyup",
            this.boundHandlers.keyup
        );

        if (this.target) {
            this.target.removeEventListener(
                "pointerdown",
                this.boundHandlers.pointerdown
            );

            this.target.removeEventListener(
                "pointerup",
                this.boundHandlers.pointerup
            );

            this.target.removeEventListener(
                "pointercancel",
                this.boundHandlers.pointercancel
            );

            this.target.removeEventListener(
                "pointermove",
                this.boundHandlers.pointermove
            );
        }

        window.removeEventListener(
            "gamepadconnected",
            this.boundHandlers.gamepadconnected
        );

        window.removeEventListener(
            "gamepaddisconnected",
            this.boundHandlers.gamepadconnected
        );

        this.keys.clear();
        this.buttons.clear();
        this.pointers.clear();
        this.gamepads.clear();

        this.target = null;
        this.attached = false;
    }

    handleKeyDown(event) {
        this.keys.add(event.code);

        this.emit("keydown", {
            code: event.code,
            key: event.key,
            originalEvent: event
        });
    }

    handleKeyUp(event) {
        this.keys.delete(event.code);

        this.emit("keyup", {
            code: event.code,
            key: event.key,
            originalEvent: event
        });
    }

    handlePointerDown(event) {
        this.pointers.set(event.pointerId, {
            id: event.pointerId,
            type: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            buttons: event.buttons
        });

        this.emit("pointerdown", this.getPointerData(event));
    }

    handlePointerUp(event) {
        this.pointers.delete(event.pointerId);

        this.emit("pointerup", {
            id: event.pointerId,
            type: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            buttons: event.buttons,
            originalEvent: event
        });
    }

    handlePointerMove(event) {
        if (!this.pointers.has(event.pointerId)) {
            return;
        }

        this.pointers.set(event.pointerId, {
            id: event.pointerId,
            type: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            buttons: event.buttons
        });

        this.emit("pointermove", this.getPointerData(event));
    }

    getPointerData(event) {
        return {
            id: event.pointerId,
            type: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            buttons: event.buttons,
            originalEvent: event
        };
    }

    handleGamepadConnected(event) {
        const gamepad = event.gamepad;

        this.gamepads.set(
            gamepad.index,
            gamepad
        );

        this.emit("gamepadconnected", gamepad);
    }

    handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;

        this.gamepads.delete(
            gamepad.index
        );

        this.emit(
            "gamepaddisconnected",
            gamepad
        );
    }

    updateGamepads() {
        if (!navigator.getGamepads) {
            return;
        }

        const pads = navigator.getGamepads();

        for (const gamepad of pads) {
            if (!gamepad) {
                continue;
            }

            this.gamepads.set(
                gamepad.index,
                gamepad
            );
        }
    }

    isKeyDown(code) {
        return this.keys.has(code);
    }

    isButtonDown(button) {
        return this.buttons.has(button);
    }

    getPointer(pointerId) {
        return this.pointers.get(pointerId) || null;
    }

    getGamepad(index = 0) {
        this.updateGamepads();

        return this.gamepads.get(index) || null;
    }

    on(eventName, callback) {
        if (typeof callback !== "function") {
            return () => {};
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(
                eventName,
                new Set()
            );
        }

        const listeners =
            this.listeners.get(eventName);

        listeners.add(callback);

        return () => {
            listeners.delete(callback);
        };
    }

    emit(eventName, data) {
        const listeners =
            this.listeners.get(eventName);

        if (!listeners) {
            return;
        }

        for (const callback of listeners) {
            callback(data);
        }
    }

    clear() {
        this.keys.clear();
        this.buttons.clear();
        this.pointers.clear();
        this.gamepads.clear();
    }
}

export { InputManager };
export default InputManager;