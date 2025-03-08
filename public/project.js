let project = {
    patterns: [],
    timeline: []
};

let autosaveTimer = null;
let playTimeouts = [];
let playingAudios = [];
let currentEditingPatternId = null;
let playheadInterval = null;
let timelineItemCounter = 0;
let isPlaying = false;
let highestPatternZ = 5;

const numPianoCols = 32;
const numPianoRows = 24;
const sampleCache = {};

const ROW_HEIGHT = 40;
let currentBPM = 60;

const availableSounds = {
    bass: [
        "./assets/sounds/bass/bass1.wav",
        "./assets/sounds/bass/bass2.wav",
        "./assets/sounds/bass/bass3.wav",
        "./assets/sounds/bass/bass4.wav"
    ],
    drums: [
        "./assets/sounds/drums/claps/clap1.wav",
        "./assets/sounds/drums/claps/clap2.wav",
        "./assets/sounds/drums/claps/clap3.wav",
        "./assets/sounds/drums/claps/clap4.wav",
        "./assets/sounds/drums/hihats/hihat1.wav",
        "./assets/sounds/drums/hihats/hihat2.wav",
        "./assets/sounds/drums/hihats/hihat3.wav",
        "./assets/sounds/drums/hihats/hihat4.wav",
        "./assets/sounds/drums/kicks/kick1.wav",
        "./assets/sounds/drums/kicks/kick2.wav",
        "./assets/sounds/drums/kicks/kick3.wav",
        "./assets/sounds/drums/kicks/kick4.wav",
        "./assets/sounds/drums/snares/snare1.wav",
        "./assets/sounds/drums/snares/snare2.wav",
        "./assets/sounds/drums/snares/snare3.wav",
        "./assets/sounds/drums/snares/snare4.wav"
    ],
    piano: [
        "./assets/sounds/piano/piano1.wav",
        "./assets/sounds/piano/piano2.wav",
        "./assets/sounds/piano/piano3.wav",
        "./assets/sounds/piano/piano4.wav"
    ],
    synths: [
        "./assets/sounds/synths/synth1.wav",
        "./assets/sounds/synths/synth2.wav",
        "./assets/sounds/synths/synth3.wav",
        "./assets/sounds/synths/synth4.wav"
    ],
    custom: []
};

function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
    const ca = document.cookie.split(';');
    const prefix = name + "=";
    for (let c of ca) {
        c = c.trim();
        if (c.indexOf(prefix) === 0) {
            return decodeURIComponent(c.substring(prefix.length));
        }
    }
    return null;
}

function autoSaveProject() {
    document.getElementById("autosaveStatus").textContent = "Saving...";
    setCookie("project", JSON.stringify(project), 7);
    setTimeout(() => {
        document.getElementById("autosaveStatus").textContent = "Autosaved";
    }, 500);
}

function loadProjectFromCookie() {
    const cookieData = getCookie("project");
    if (cookieData) {
        try {
            project = JSON.parse(cookieData);
            updatePatternsListUI();
            updateTimelineUI();
        } catch (e) {
            console.error("Failed to parse project cookie", e);
        }
    }
}

function downloadProject() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "project.json");
    dlAnchorElem.click();
}

function openProjectFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            project = JSON.parse(e.target.result);
            updatePatternsListUI();
            updateTimelineUI();
        } catch (err) {
            alert("Invalid project file.");
        }
    };
    reader.readAsText(file);
}

function resetProject() {
    project = {
        patterns: [],
        timeline: []
    };

    updatePatternsListUI();
    updateTimelineUI();
    autoSaveProject();
}

async function renderProjectAudio() {

    let totalDuration = 0;
    project.timeline.forEach(item => {
        const pattern = project.patterns.find(p => p.id === item.patternId);
        if (pattern) {
            totalDuration = Math.max(totalDuration, item.startTime + pattern.length);
        }
    });

    if (totalDuration <= 0) {
        showErrorMessage("You've got nothing in your project... What do you want to download?")
    }

    const sampleRate = 44100;
    const length = sampleRate * totalDuration;
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    for (const item of project.timeline) {
        const pattern = project.patterns.find(p => p.id === item.patternId);
        if (!pattern) continue;

        for (const soundPath of pattern.sounds) {
            try {
                const response = await fetch(soundPath);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

                const source = offlineCtx.createBufferSource();
                source.buffer = audioBuffer;

                const gainNode = offlineCtx.createGain();
                gainNode.gain.value = pattern.volume !== undefined ? pattern.volume : 1;

                source.connect(gainNode).connect(offlineCtx.destination);

                source.start(item.startTime);
            } catch (err) {
                console.error("Error processing", soundPath, err);
            }
        }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer;
}

function audioBufferToWav(buffer, opt) {
    opt = opt || {};
    var numChannels = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var format = opt.float32 ? 3 : 1;
    var bitDepth = format === 3 ? 32 : 16;

    var result;
    if (numChannels === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }
    return encodeWAV(result, numChannels, sampleRate, bitDepth, format);
}

function interleave(inputL, inputR) {
    var length = inputL.length + inputR.length;
    var result = new Float32Array(length);
    var index = 0;
    var inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

function encodeWAV(samples, numChannels, sampleRate, bitDepth, format) {
    var bytesPerSample = bitDepth / 8;
    var blockAlign = numChannels * bytesPerSample;
    var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    var view = new DataView(buffer);

    writeString(view, 0, 'RIFF');

    view.setUint32(4, 36 + samples.length * bytesPerSample, true);

    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');

    view.setUint32(16, 16, true);

    view.setUint16(20, format, true);

    view.setUint16(22, numChannels, true);

    view.setUint32(24, sampleRate, true);

    view.setUint32(28, sampleRate * blockAlign, true);

    view.setUint16(32, blockAlign, true);

    view.setUint16(34, bitDepth, true);

    writeString(view, 36, 'data');

    view.setUint32(40, samples.length * bytesPerSample, true);

    if (bitDepth === 16) {
        floatTo16BitPCM(view, 44, samples);
    } else {
        writeFloat32(view, 44, samples);
    }
    return buffer;
}

function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function floatTo16BitPCM(output, offset, input) {
    for (var i = 0; i < input.length; i++, offset += 2) {
        var s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeFloat32(output, offset, input) {
    for (var i = 0; i < input.length; i++, offset += 4) {
        output.setFloat32(offset, input[i], true);
    }
}

async function exportProjectAsWAV() {
    try {
        const renderedBuffer = await renderProjectAudio();
        const wavArrayBuffer = audioBufferToWav(renderedBuffer);
        const blob = new Blob([wavArrayBuffer], {
            type: 'audio/wav'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "project_export.wav";
        a.click();
    } catch (error) {
        console.error("Error rendering project audio to WAV:", error);
    }
}

async function exportProjectAsMP3() {
    try {
        const renderedBuffer = await renderProjectAudio();
        const mp3Blob = convertAudioBufferToMp3(renderedBuffer);
        const url = URL.createObjectURL(mp3Blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "project_export.mp3";
        a.click();
    } catch (error) {
        console.error("Error rendering project audio to MP3:", error);
    }
}

function convertAudioBufferToMp3(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
    let mp3Data = [];
    const blockSize = 1152;
    let channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
        channels.push(audioBuffer.getChannelData(ch));
    }
    const sampleLength = audioBuffer.length;
    for (let i = 0; i < sampleLength; i += blockSize) {
        let left, right;
        if (numChannels === 1) {
            left = channels[0].subarray(i, i + blockSize);
            var mp3buf = mp3Encoder.encodeBuffer(left);
        } else {
            left = channels[0].subarray(i, i + blockSize);
            right = channels[1].subarray(i, i + blockSize);
            var mp3buf = mp3Encoder.encodeBuffer(left, right);
        }
        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }
    }
    const d = mp3Encoder.flush();
    if (d.length > 0) {
        mp3Data.push(new Int8Array(d));
    }
    return new Blob(mp3Data, {
        type: 'audio/mp3'
    });
}