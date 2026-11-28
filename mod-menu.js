(() => {
    const byId = id => document.getElementById(id);
    const menu = byId("mods");
    const fields = menu.querySelector("fieldset");
    const keys = new Set();
    let enabled = false;
    let chordUsed = false;
    let original = null;

    let view = "choose-role";
    let generation = 0;

    function showView(next) {
        generation++;
        view = next;
        menu.dataset.view = next;
        for (const id of ["choose-role", "unlock", "standard", "founder"]) byId(id).hidden = id !== next;
        byId("change-role").hidden = next === "choose-role";
        byId("mods-title").textContent = {standard:"Standard", founder:"Founder", unlock:"Founder access", "choose-role":"Choose a panel"}[next];
        byId("code").value = "";
        byId("code-status").textContent = "";
        byId("points").value = byId("standard-points").value = "1";
        byId("goggles").value = "none";
        original = null;
        sync();
        if (next === "unlock") byId("code").focus();
    }
    byId("standard-role").onclick = () => showView("standard");
    byId("founder-role").onclick = () => showView("unlock");
    byId("change-role").onclick = () => showView("choose-role");
    byId("unlock").onsubmit = async event => {
        event.preventDefault();
        if (!enabled || view !== "unlock") return;
        const attempt = ++generation;
        const encoder = new TextEncoder();
        try {
            const key = await crypto.subtle.importKey("raw", encoder.encode(byId("code").value), "PBKDF2", false, ["deriveBits"]);
            const bits = await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", iterations:150000,
                salt:encoder.encode("7c35821058ae02b1ef05997d8faf7f48")}, key, 256);
            if (attempt !== generation || !menu.open) return;
            const hash = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, "0")).join("");
            if (hash === "b36b1cf4ff8368ba1fd8985bc5864907e2e8f3787cc9665932fc460d9c71a37d") showView("founder");
            else {
                byId("code-status").textContent = "Incorrect passcode.";
                byId("code").select();
            }
        } catch {
            if (attempt === generation) byId("code-status").textContent = "Unable to check the passcode. Open the HTTPS game link.";
        }
    };

    function sync() {
        const engine = window.gameInstance?.Module?.asm;
        if (!engine?.godMode) return;
        const founder = enabled && view === "founder";
        const standard = enabled && view === "standard";
        const protectedNow = (standard || founder) && !menu.open && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
        engine.godMode.value = Number(protectedNow);
        const preset = byId("points").selectedOptions[0];
        const standardValue = Number(byId("standard-points").value);
        const limited = standard && [1, 3, 10].includes(standardValue) ? standardValue : 1;
        engine.scoreMultiplier.value = founder ? Number(preset.value) : limited;
        engine.speedMultiplier.value = founder ? Number(preset.dataset.speed) : limited;
        const scene = byId("gameContainer");
        const lens = founder ? byId("goggles").value : "none";
        if (scene.dataset.lens !== lens) scene.dataset.lens = lens;
        if (founder && menu.open) {
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
        if (!enabled || view !== "founder" || !original || !fields.form.reportValidity()) return;
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
        if (view === "unlock") showView("choose-role");
        original = null;
        document.querySelector("canvas")?.focus();
        sync();
    });

    function handleKey(event) {
        const {code} = event;
        const shortcut = code === "KeyR" || code === "KeyF";
        if (!shortcut && code !== "ShiftLeft" && code !== "ShiftRight") return;
        if (event.type === "keydown" && (event.ctrlKey || event.altKey || event.metaKey)) return;
        const typingCode = event.target === byId("code");
        if (shortcut && !typingCode) {
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
                    showView("choose-role");
                }
            }
        } else {
            if (!keys.delete(code)) return;
            // Decide on release so R-first chords never flash the dialog.
            if (code === "KeyR" && !typingCode && !chordUsed && enabled) {
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
    showView("choose-role");
    setInterval(sync, 250);
})();
