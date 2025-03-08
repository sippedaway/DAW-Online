function playSample(soundPath, startDelay, noteDuration, playbackRate, volume) {
  if (sampleCache[soundPath]) {
      const buffer = sampleCache[soundPath];
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = volume !== undefined ? volume : 1;
      source.connect(gainNode).connect(analyser);
      analyser.connect(audioCtx.destination);
      source.start(audioCtx.currentTime + startDelay);
      source.stop(audioCtx.currentTime + startDelay + noteDuration);
  } else {
      fetch(soundPath)
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
          .then(buffer => {
              sampleCache[soundPath] = buffer;
              const source = audioCtx.createBufferSource();
              source.buffer = buffer;
              source.playbackRate.value = playbackRate;
              const gainNode = audioCtx.createGain();
              gainNode.gain.value = volume !== undefined ? volume : 1;
              source.connect(gainNode).connect(analyser);
              analyser.connect(audioCtx.destination);
              source.start(audioCtx.currentTime + startDelay);
              source.stop(audioCtx.currentTime + startDelay + noteDuration);
          })
          .catch(err => {
              console.error("Error playing sample", err);
          });
  }
}


function noteNumberToName(noteNumber) {
  const octave = Math.floor(noteNumber / 12) - 1;
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return notes[noteNumber % 12] + octave;
}

function noteNameToNumber(noteName) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const note = noteName.slice(0, -1);
  const octave = parseInt(noteName.slice(-1));
  if (notes.indexOf(note) === -1 || isNaN(octave)) {
      throw new Error(`Invalid note name: ${noteName}`);
  }
  return notes.indexOf(note) + (octave + 1) * 12;
}

function playProject() {
  if (isPlaying) {
      stopPlayback();
      return;
  }
  isPlaying = true;
  const playBtn = document.getElementById("playButton");
  playBtn.classList.add("active");
  const startTimestamp = Date.now();
  const playhead = document.getElementById("playhead");
  playhead.style.left = "0px";
  if (playheadInterval) clearInterval(playheadInterval);
  playheadInterval = setInterval(() => {
      const elapsed = (Date.now() - startTimestamp) / 1000;
      const scaledElapsed = elapsed * (currentBPM / 60);
      playhead.style.left = (scaledElapsed * 100) + "px";
  }, 16);
  const audioStartTime = audioCtx.currentTime;
  const timelineItems = project.timeline.slice().sort((a, b) => a.startTime - b.startTime);
  timelineItems.forEach(item => {
      // Schedule the timeline item using setTimeout (for visual synchronization)
      const timeoutId = setTimeout(() => {
          const pattern = project.patterns.find(p => p.id === item.patternId);
          if (!pattern) return;
          const baseTime = audioStartTime + item.startTime * (60 / currentBPM);
          const patternLength = item.length * (60 / currentBPM); // Calculate the pattern length in seconds
          // If piano roll notes exist and a sound is selected, use sample playback with pitch shifting.
          if (pattern.notes && pattern.notes.length > 0 && pattern.sounds && pattern.sounds.length > 0) {
              const soundPath = pattern.sounds[0];
              const lowestPitch = 48;
              pattern.notes.forEach(note => {
                  const absNoteStart = baseTime + note.startTime * (60 / currentBPM);
                  const noteDuration = (item.length / numPianoCols) * (60 / currentBPM);
                  const pitch = noteNameToNumber(note.noteName);
                  const desiredFrequency = 440 * Math.pow(2, ((pitch - 69) / 12));
                  const baseFrequency = 261.63; // assuming sample was recorded at middle C (MIDI 60)
                  const playbackRate = desiredFrequency / baseFrequency;
                  // Schedule playback relative to the current audio context time
                  playSample(soundPath, absNoteStart - audioCtx.currentTime, noteDuration, playbackRate, pattern.volume);
              });
          } else if (pattern.sounds && pattern.sounds.length) {
              // Fallback: play the selected sound files without pitch shifting
              pattern.sounds.forEach(soundPath => {
                  const audio = new Audio(soundPath);
                  audio.volume = pattern.volume !== undefined ? pattern.volume : 1;
                  audioCtx.resume();
                  const source = audioCtx.createMediaElementSource(audio);
                  source.connect(analyser);
                  analyser.connect(audioCtx.destination);
                  audio.play();
                  playingAudios.push(audio);
                  // Stop the audio after the pattern length
                  setTimeout(() => {
                      audio.pause();
                      audio.currentTime = 0;
                  }, patternLength * 1000);
              });
          }
      }, item.startTime * 1000 * (60 / currentBPM));
      playTimeouts.push(timeoutId);
  });

  // Stop playback after the last timeline item ends
  const lastItem = timelineItems[timelineItems.length - 1];
  if (lastItem) {
      const lastItemEndTime = lastItem.startTime + lastItem.length;
      const stopTimeoutId = setTimeout(() => {
          stopPlayback();
      }, lastItemEndTime * 1000 * (60 / currentBPM));
      playTimeouts.push(stopTimeoutId);
  }
}

function stopPlayback() {
  playTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  playTimeouts = [];
  playingAudios.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
  });
  playingAudios = [];

  // Stop all AudioBufferSourceNodes
  if (audioCtx.state === 'running') {
      audioCtx.suspend().then(() => {
          audioCtx.resume(); // Resume the context to allow future playback
      });
  }

  document.getElementById("playButton").classList.remove("active");
  if (playheadInterval) {
      clearInterval(playheadInterval);
      playheadInterval = null;
  }
  document.getElementById("playhead").style.left = "0px";
  isPlaying = false;
}

function playNoteSound(note) {
  const pattern = project.patterns.find(p => p.id === currentEditingPatternId);
  if (pattern && pattern.sounds && pattern.sounds.length > 0) {
      const soundPath = pattern.sounds[0];
      const lowestPitch = 48;
      const pitch = lowestPitch + (numPianoRows - 1 - note.row);
      const desiredFrequency = 440 * Math.pow(2, ((pitch - 69) / 12));
      const baseFrequency = 261.63;
      const playbackRate = desiredFrequency / baseFrequency;

      if (audioCtx.state === 'suspended') {
          audioCtx.resume().then(() => {
              playSample(soundPath, 0, 1, playbackRate, pattern.volume);
          });
      } else {
          playSample(soundPath, 0, 1, playbackRate, pattern.volume);
      }
  }
}

let audioCtx = new(window.AudioContext || window.webkitAudioContext)();
let analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
let bufferLength = analyser.frequencyBinCount;
let dataArray = new Uint8Array(bufferLength);
const visualizerCanvas = document.getElementById("visualizer");
const visualizerCtx = visualizerCanvas.getContext("2d");

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  analyser.getByteFrequencyData(dataArray);
  visualizerCtx.fillStyle = "#000";
  visualizerCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
  let barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
  let barHeight, x = 0;
  for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];
      visualizerCtx.fillStyle = "rgb(" + (barHeight + 100) + ",50,50)";
      visualizerCtx.fillRect(x, visualizerCanvas.height - barHeight / 2, barWidth, barHeight / 2);
      x += barWidth + 1;
  }
}
drawVisualizer();