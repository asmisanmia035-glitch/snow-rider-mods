const menu = document.querySelector("#mods");
const shield = document.querySelector("#shield");
const points = document.querySelector("#points");
const goggles = document.querySelector("#goggles");
function syncMods() {
    const engine = window.gameInstance?.Module?.asm;
    if (!engine?.godMode) return;
    engine.godMode.value = Number(shield.checked);
    engine.scoreMultiplier.value = Number(points.value);
    document.querySelector("#saves").textContent = "Crashes saved · " + engine.crashSaves.value;
}
menu.addEventListener("change", () => {
    document.querySelector("#gameContainer").style.filter = goggles.value;
    syncMods();
});
document.querySelector("#close-mods").onclick = () => menu.close();
menu.addEventListener("close", () => document.querySelector("canvas")?.focus());
window.addEventListener("keydown", event => {
    if (event.code !== "KeyR" || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (menu.open) menu.close();
    else { menu.showModal(); syncMods(); }
}, true);
// Picks up choices made while Unity was loading, even if the menu is closed.
setInterval(syncMods, 250);
