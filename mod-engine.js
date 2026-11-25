// The upstream release ships IL2CPP WebAssembly. Apply these edits to its
// decompressed module before Unity instantiates it. Offsets refer to that build.
function patchSnowRider(binary) {
    const bytes = new Uint8Array(binary);
    if (bytes.length !== 23827632) throw Error("Unexpected Snow Rider build");
    const edits = [];
    function edit(offset, before, after) {
        if (!before.every((byte, i) => bytes[offset + i] === byte)) {
            throw Error("Incompatible game build at " + offset);
        }
        edits.push({offset, before, after});
    }
    function unsigned(value) {
        const result = [];
        do {
            const digit = value & 127;
            value >>>= 7;
            result.push(value ? digit | 128 : digit);
        } while (value);
        return result;
    }
    function resize(offset, original, delta) {
        edit(offset, unsigned(original), unsigned(original + delta));
    }
    // Seven imported globals precede ten defined globals.
    const god = 17, multiplier = 18, saves = 19;
    const globals = [0, 1, 0].flatMap(initial => [0x7f, 1, 0x41, initial, 0x0b]);
    resize(0x14f1d, 51, globals.length);
    resize(0x14f1e, 10, 3);
    edit(0x14f51, [], globals);
    const exports = ["godMode", "scoreMultiplier", "crashSaves"].flatMap((name, i) =>
        [name.length, ...new TextEncoder().encode(name), 3, god + i]);
    resize(0x14f52, 0x3dad, exports.length);
    resize(0x14f54, 548, 3);
    edit(0x18d01, [], exports);

    // PlayerControl.Collision has just confirmed a lethal raycast here.
    // Count the save and return before it broadcasts the game-over event.
    const shield = [0x23, god, 0x04, 0x40, 0x23, saves, 0x41, 1, 0x6a,
        0x24, saves, 0x0f, 0x0b];
    const collision = 11556691;
    const deathBranch = [0x10, 0xb0, 0xcb, 1, 4, 0x40];
    edit(collision + 38, deathBranch, [...deathBranch, ...shield]);
    resize(collision - 1, 106, shield.length);

    // PlayScore.AddScore adds this value to the distance score.
    const score = 11553101;
    const scoreBody = bytes.subarray(score, score + 253);
    const add = [0x28, 2, 36, 0x41, 1, 0x6a, 0x36, 2, 36];
    const at = scoreBody.findIndex((_, i) => add.every((v, j) => v === scoreBody[i+j]));
    if (at < 0) throw Error("Score instruction missing");
    edit(score + at + 3, [0x41, 1], [0x23, multiplier]);
    resize(0x6bb82, 0x1382b5a, shield.length);

    edits.sort((a,b) => a.offset - b.offset);
    const output = new Uint8Array(bytes.length + edits.reduce((n,e) =>
        n + e.after.length - e.before.length, 0));
    let source = 0, destination = 0;
    for (const e of edits) {
        output.set(bytes.subarray(source, e.offset), destination);
        destination += e.offset - source;
        output.set(e.after, destination);
        destination += e.after.length;
        source = e.offset + e.before.length;
    }
    output.set(bytes.subarray(source), destination);
    return output;
}
UnityLoader.processWasmCodeJob = function(module, job) {
    module.wasmBinary = patchSnowRider(UnityLoader.Job.result(module, "downloadWasmCode"));
    job.complete();
};
