(() => {
    const byId = id => document.getElementById(id);
    const menu = byId("mods");
    const fields = menu.querySelector("fieldset");
    const keys = new Set();
    let enabled = false;
    let chordUsed = false;
    let original = null;

    function sync() {
        const engine = window.gameInstance?.Module?.asm;
        if (!engine?.godMode) return;
        const protectedNow = enabled && !menu.open && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
        engine.godMode.value = Number(protectedNow);
        engine.scoreMultiplier.value = enabled ? Number(byId("points").value) : 1;
        const scene = byId("gameContainer");
        const lens = enabled ? byId("goggles").value : "none";
        if (scene.dataset.lens !== lens) scene.dataset.lens = lens;
        if (menu.open) {
            byId("saves").textContent = "Crashes saved · " + engine.crashSaves.value;
            if (!original) loadStats();
        }
    }

    function prefs() {
        const module = window.gameInstance?.Module;
        const heap = module?.HEAP32;
        const engine = module?.asm;
        // Wait for GameControl and its wallet-changed event in the loaded scene.
        const klass = heap?.[3362936 / 4];
        const statics = klass && heap[(klass + 92) / 4];
        if (!engine?.getGifts || !statics || !heap[(statics + 80) / 4]) return null;
        // Resolve the same managed string literals used by UpdateScore and get_plays.
        engine.initializeMetadata(heap[849484 / 4]);
        const plays = engine.getPlays(0);
        const bestKey = heap[3441048 / 4];
        const playsKey = heap[3441228 / 4];
        if (!bestKey || !playsKey) return null;
        return {engine, bestKey, playsKey, plays};
    }

    function loadStats() {
        const p = prefs();
        fields.disabled = !p;
        if (!p) { byId("status").textContent = "Waiting for the game…"; return; }
        original = {gifts:p.engine.getGifts(0), plays:p.plays, best:p.engine.getPreference(p.bestKey, 0)};
        for (const [id, value] of Object.entries(original)) {
            byId(id).value = value;
            byId(id).setCustomValidity("");
        }
        byId("status").textContent = "";
    }

    for (const field of fields.querySelectorAll("input")) {
        field.addEventListener("focus", () => field.select());
        field.addEventListener("input", () => field.setCustomValidity(
            Number(field.value) > 2147483646 ? "Enter a value up to 2147483646." : ""));
    }
    byId("stats").addEventListener("submit", event => {
        event.preventDefault();
        if (!enabled || !original || !fields.form.reportValidity()) return;
        const p = prefs();
        if (!p) return;
        // Only write edited fields. Normal play can change another stat while the menu is open.
        const value = id => Number(byId(id).value);
        if (value("gifts") !== original.gifts) p.engine.setGifts(value("gifts"), 0);
        if (value("plays") !== original.plays) p.engine.setPreference(p.playsKey, value("plays"), 0);
        if (value("best") !== original.best) p.engine.setPreference(p.bestKey, value("best"), 0);
        p.engine.savePreferences(0);
        loadStats();
        byId("status").textContent = "Stats saved";
    });
    menu.addEventListener("change", sync);
    byId("close-mods").onclick = () => menu.close();
    menu.addEventListener("close", () => {
        original = null;
        document.querySelector("canvas")?.focus();
        sync();
    });

    function handleKey(event) {
        const {code} = event;
        const shortcut = code === "KeyR" || code === "KeyF";
        if (!shortcut && code !== "ShiftLeft" && code !== "ShiftRight") return;
        if (event.type === "keydown" && (event.ctrlKey || event.altKey || event.metaKey)) return;
        if (shortcut) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        if (event.type === "keydown") {
            if (event.repeat || keys.has(code)) return;
            keys.add(code);
            if (!chordUsed && keys.has("KeyR") && keys.has("KeyF")) {
                chordUsed = true;
                enabled = !enabled;
                if (!enabled) {
                    if (menu.open) menu.close();
                    byId("points").value = "1";
                    byId("goggles").value = "none";
                }
            }
        } else {
            if (!keys.delete(code)) return;
            // Decide on release so R-first chords never flash the dialog.
            if (code === "KeyR" && !chordUsed && enabled) {
                if (menu.open) menu.close();
                else { original = null; menu.showModal(); }
            }
            if (!keys.has("KeyR") && !keys.has("KeyF")) chordUsed = false;
        }
        sync();
    }
    function clearKeys() { keys.clear(); chordUsed = false; sync(); }
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("keyup", handleKey, true);
    // Keep Unity's keyboard listener from cancelling native text editing.
    for (const type of ["keydown", "keypress", "keyup"]) {
        window.addEventListener(type, event => {
            if (menu.open && menu.contains(event.target)) event.stopImmediatePropagation();
        }, true);
    }
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearKeys(); });
    setInterval(sync, 250);
})();
