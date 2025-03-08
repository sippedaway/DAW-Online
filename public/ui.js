function updatePatternsListUI() {
    const list = document.getElementById("patternsList");
    list.innerHTML = "";
    project.patterns.forEach(pattern => {
        const div = document.createElement("div");
        div.className = "pattern-item";
        div.textContent = pattern.name;
        div.dataset.patternId = pattern.id;
        div.setAttribute("draggable", "true");
        div.addEventListener("click", () => openPatternPopup(pattern.id));
        div.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", pattern.id);
        });
        div.addEventListener("dragend", () => {
            div.classList.remove("dragging");
        });
        list.appendChild(div);
    });
}

function updateTimelineUI() {
    const timeline = document.getElementById("timeline");
    timeline.innerHTML = "";
    project.timeline.forEach(item => {
        const pattern = project.patterns.find(p => p.id === item.patternId);
        if (!pattern) return;
        const div = document.createElement("div");
        div.className = "timeline-item";
        div.textContent = pattern.name;
        div.dataset.timelineId = item.id;
        div.style.left = (item.startTime * 100) + "px";
        div.style.top = (item.track * ROW_HEIGHT) + "px";
        const itemLength = item.length !== undefined ? item.length : (pattern.length && pattern.length > 0 ? pattern.length : 1);
        div.style.width = (itemLength * 100) + "px";
        enableTimelineItemDrag(div, item);
        enableTimelineItemResize(div, item);
        div.addEventListener("contextmenu", e => {
            e.preventDefault();
            div.style.opacity = "0";
            setTimeout(() => {
                removeTimelineItem(div.dataset.timelineId);
            }, 150);
        });
        timeline.appendChild(div);
    });
    updateTracklistLength();
    updateTimelineMarkers();
}

function updateTracklistLength() {
    let maxTime = 0;
    project.timeline.forEach(item => {
        const pattern = project.patterns.find(p => p.id === item.patternId);
        if (pattern) {
            const endTime = item.startTime + pattern.length;
            if (endTime > maxTime) maxTime = endTime;
        }
    });
    document.getElementById("tracklistLength").textContent = formatTime(maxTime);
}

function enableTimelineItemResize(itemElem, timelineItem) {
    const resizer = document.createElement("div");
    resizer.classList.add("timeline-item-resizer");
    itemElem.appendChild(resizer);

    let isResizing = false;
    let startX;
    let startWidth;

    resizer.addEventListener("mousedown", function(e) {
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startWidth = parseFloat(itemElem.style.width);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    function onMouseMove(e) {
        if (!isResizing) return;
        let deltaX = e.clientX - startX;
        let newWidth = startWidth + deltaX;
        if (newWidth < 20) newWidth = 20;
        itemElem.style.width = newWidth + "px";
        timelineItem.length = newWidth / 100;
        updateTracklistLength();
        autoSaveProject();
    }

    function onMouseUp(e) {
        if (isResizing) {
            isResizing = false;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        }
    }
}


function formatTime(seconds) {
    let minutes = Math.floor(seconds / 60);
    let secs = Math.floor(seconds % 60);
    let ms = Math.floor((seconds - Math.floor(seconds)) * 100);
    return String(minutes).padStart(2, '0') + ":" + String(secs).padStart(2, '0') + ":" + String(ms).padStart(2, '0');
}

function enableTimelineItemDrag(itemElem, timelineItem) {
    let startX = 0,
        startY = 0,
        initialLeft = 0,
        initialTop = 0;

    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        itemElem.style.left = newLeft + "px";
        itemElem.style.top = newTop + "px";
    }

    function onMouseUp(e) {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        const newLeft = parseFloat(itemElem.style.left);
        const newTop = parseFloat(itemElem.style.top);
        timelineItem.startTime = newLeft / 100;
        timelineItem.track = Math.round(newTop / ROW_HEIGHT);
        updateTimelineUI();
        autoSaveProject();
    }
    itemElem.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        itemElem.style.zIndex = highestPatternZ + 1;
        highestPatternZ += 1;
        initialLeft = parseFloat(itemElem.style.left) || 0;
        initialTop = parseFloat(itemElem.style.top) || 0;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });
}

function removeTimelineItem(timelineId) {
    project.timeline = project.timeline.filter(item => item.id !== timelineId);
    updateTimelineUI();
    autoSaveProject();
}

function setupTimelineDrop() {
    const timeline = document.getElementById("timeline");
    timeline.addEventListener("dragover", (e) => {
        e.preventDefault();
    });
    timeline.addEventListener("drop", (e) => {
        e.preventDefault();
        const patternId = e.dataTransfer.getData("text/plain");
        const rect = timeline.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        const startTime = offsetX / 100;
        const track = Math.round(offsetY / ROW_HEIGHT);
        const pattern = project.patterns.find(p => p.id === patternId);
        const defaultLength = (pattern && pattern.length && pattern.length > 0) ? pattern.length : 1;

        project.timeline.push({
            id: "tl_" + timelineItemCounter++,
            patternId,
            startTime,
            track,
            length: defaultLength
        });
        updateTimelineUI();
        autoSaveProject();
    });
}

function populatePopupMenu() {
    const menuItems = document.querySelectorAll(".popup-menu li");
    menuItems.forEach(li => {
        li.classList.remove("active");
        li.addEventListener("click", () => {
            menuItems.forEach(item => item.classList.remove("active"));
            li.classList.add("active");
            populatePopupContent(li.dataset.category);
        });
    });
    if (menuItems.length > 0) {
        menuItems[0].classList.add("active");
        populatePopupContent(menuItems[0].dataset.category);
    }
}

function populatePopupContent(category) {
    const content = document.querySelector(".popup-content");
    content.innerHTML = "";

    const currentPattern = project.patterns.find(p => p.id === currentEditingPatternId);

    let sounds = [];
    if (category === "Custom") {
        const uploadBtn = document.createElement("button");
        uploadBtn.textContent = "Upload Custom Sound";
        uploadBtn.className = "upload-btn";
        uploadBtn.addEventListener("click", () => {
            document.getElementById("customFileInput").click();
        });
        content.appendChild(uploadBtn);
        sounds = availableSounds.custom;
    } else if (category === "More") {
        content.innerHTML = `<div class="more-content">
      <p>Want more sounds than my stupid and boring library? Check out <a href="https://freesound.org" target="_blank">Freesound.org</a> or other websites :)</p>
      </div>`;
        return;
    } else if (category === "Drums") {
        sounds = availableSounds.drums;
    } else {
        sounds = availableSounds[category.toLowerCase()] || [];
    }
    sounds.forEach(sound => {
        const item = document.createElement("div");
        item.className = "sound-item";
        item.textContent = sound.split("/").pop();
        item.dataset.soundPath = sound;

        if (currentPattern && currentPattern.sounds && currentPattern.sounds.includes(sound)) {
            item.classList.add("selected");
        }

        item.addEventListener("click", () => {
            item.classList.toggle("selected");
            const preview = new Audio(sound);
            preview.volume = 0.5;
            preview.play();
        });
        content.appendChild(item);
    });
}

function openPatternPopup(patternId) {
    currentEditingPatternId = patternId;
    const modal = document.getElementById("patternPopup");
    modal.style.display = "block";
    const pattern = project.patterns.find(p => p.id === patternId);
    if (pattern) {
        document.getElementById("patternNameInput").value = pattern.name;
        document.getElementById("volumeSlider").value = pattern.volume !== undefined ? pattern.volume : 1;
    }
    populatePopupMenu();
}

function savePatternDesign() {
    const selectedItems = document.querySelectorAll(".popup-content .sound-item.selected");
    const selectedSounds = Array.from(selectedItems).map(item => item.dataset.soundPath);
    const pattern = project.patterns.find(p => p.id === currentEditingPatternId);
    if (pattern) {
        pattern.name = document.getElementById("patternNameInput").value || pattern.name;
        pattern.volume = parseFloat(document.getElementById("volumeSlider").value);
        pattern.sounds = selectedSounds;
    }
    closePatternPopup();
}

function closePatternPopup() {
    document.getElementById("patternPopup").style.display = "none";
    currentEditingPatternId = null;
    updatePatternsListUI();
    autoSaveProject();
}

function createNewPattern() {
    const newId = "pattern_" + Date.now();
    const newPattern = {
        id: newId,
        name: "Pattern " + (project.patterns.length + 1),
        sounds: [],
        volume: 1,
        length: 1
    };
    project.patterns.push(newPattern);
    updatePatternsListUI();
    openPatternPopup(newId);
    autoSaveProject();
}

function removeCurrentPattern() {
    project.patterns = project.patterns.filter(p => p.id !== currentEditingPatternId);
    project.timeline = project.timeline.filter(item => item.patternId !== currentEditingPatternId);
    closePatternPopup();
    updatePatternsListUI();
    updateTimelineUI();
    autoSaveProject();
}

function openSelectionPopup(text, button1, b1function) {
    const spopup = document.getElementById('selectionPopup');
    const spcontent = document.getElementById('sp-content');
    const sptext = document.getElementById('sp-text');
    const spclose = document.getElementById('sp-close');

    if (!spopup || !sptext || !spcontent) return;

    spopup.style.display = 'block';
    sptext.textContent = text || '';

    const existingButtons = spopup.querySelectorAll('.hl-button');
    existingButtons.forEach(button => button.remove());

    if (button1) {
        const spb1 = document.createElement("button");
        spb1.classList.add('hl-button');
        spb1.classList.add('red-button');
        spb1.innerHTML = button1;
        spb1.addEventListener("click", () => {
            b1function();
            spopup.style.display = 'none';
        });
        spcontent.appendChild(spb1);
    }

    if (!spclose) return;

    spclose.addEventListener("click", () => {
        spopup.style.display = 'none';
    })
}

window.addEventListener("DOMContentLoaded", (e) => {
    document.getElementById("bpmInput").addEventListener("change", function(e) {
        const newBPM = parseFloat(e.target.value);
        if (!isNaN(newBPM) && newBPM > 0) {
            currentBPM = newBPM;
            updateTimelineMarkers();
        }
    });

    const errr = document.getElementById("errorPopup");

    if (e.target === errr) {
        errr.style.display = "none";
    }

    document.querySelector(".close-error").addEventListener("click", () => {
        document.getElementById("errorPopup").style.display = "none";
    });

    const fileMenu = document.getElementById("fileMenu");
    document.getElementById("fileMenuButton").addEventListener("mouseenter", () => {
        fileMenu.style.display = "block";
    });
    fileMenu.addEventListener("mouseleave", () => {
        fileMenu.style.display = "none";
    });

    document.getElementById("timelinePanel").addEventListener("wheel", function(e) {
        e.preventDefault();
        this.scrollLeft += e.deltaY;
    });

    document.getElementById("openFileBtn").addEventListener("click", () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "application/json";
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                openProjectFile(e.target.files[0]);
            }
        };
        fileInput.click();
    });
    document.getElementById("pianoRollEditorBtn").addEventListener("click", openPianoRollPopup);
    document.getElementById("closePianoRoll").addEventListener("click", closePianoRollPopup);
    document.getElementById("savePianoRollBtn").addEventListener("click", savePianoRollEditor);
    document.getElementById("downloadProjectBtn").addEventListener("click", downloadProject);
    document.getElementById("resetProjectBtn").addEventListener("click", () => {
        openSelectionPopup("This action cannot be undone.", "Reset project", resetProject);
    });
    document.getElementById("docsButton").addEventListener("click", () => {
        window.open('https://github.com/sippedaway/DAW-Online', '_blank');
    });
    document.getElementById("playButton").addEventListener("click", playProject);
    document.getElementById("stopButton").addEventListener("click", stopPlayback);
    document.getElementById("newPatternBtn").addEventListener("click", createNewPattern);
    document.querySelector(".modal .close").addEventListener("click", closePatternPopup);
    document.getElementById("savePatternBtn").addEventListener("click", savePatternDesign);
    document.getElementById("removePatternBtn").addEventListener("click", () => {
        openSelectionPopup("This action cannot be undone...", "Remove pattern", removeCurrentPattern);
    });
    document.getElementById("exportMP3Btn").addEventListener("click", exportProjectAsMP3);
    document.getElementById("exportWAVBtn").addEventListener("click", exportProjectAsWAV);
    setupTimelineDrop();
    autosaveTimer = setInterval(autoSaveProject, 5000);
    loadProjectFromCookie();

});

function openPianoRollPopup() {
    const modal = document.getElementById("pianoRollPopup");
    modal.style.display = "block";
    populatePianoRoll();
}

// Close the Piano Roll modal
function closePianoRollPopup() {
    const modal = document.getElementById("pianoRollPopup");
    modal.style.display = "none";
}

function populatePianoRoll() {
    const container = document.getElementById("pianoRollContainer");
    const notesContainer = document.getElementById("pianoRollNotes");
    const timeMarkersContainer = document.getElementById("pianoRollTimeMarkers");
    // Clear existing content
    container.innerHTML = "";
    notesContainer.innerHTML = "";
    timeMarkersContainer.innerHTML = "";

    const lowestPitch = 48;
    // Define the piano roll duration and resolution
    const PIANO_ROLL_DURATION = 10; // seconds
    const COLUMNS_PER_SECOND = 8;
    const numCols = PIANO_ROLL_DURATION * COLUMNS_PER_SECOND; // 80 columns total
    const numPianoRows = 24; // Number of note rows

    // Create a grid container for the cells
    const grid = document.createElement("div");
    grid.classList.add("piano-grid");
    // Dynamically set the grid's width and height
    grid.style.width = `${numCols * 12.5}px`;
    grid.style.height = `${numPianoRows * 40}px`;

    // Create time markers: one marker every second (aligned with the grid columns)
    for (let c = 0; c < numCols; c++) {
        const timeMarker = document.createElement("div");
        // Place a marker every 8 columns (1 second)
        if (c % COLUMNS_PER_SECOND === 0) {
            timeMarker.textContent = (c / COLUMNS_PER_SECOND).toFixed(0);
            timeMarker.style.textAlign = "center";
            timeMarker.style.fontSize = "12px";
            timeMarker.style.color = "#333";
        }
        timeMarkersContainer.appendChild(timeMarker);
    }

    // Create note labels (from highest pitch at the top)
    for (let r = 0; r < numPianoRows; r++) {
        let pitch = lowestPitch + (numPianoRows - 1 - r);
        let noteName = noteNumberToName(pitch);
        const noteLabel = document.createElement("div");
        noteLabel.textContent = noteName;
        notesContainer.appendChild(noteLabel);
    }

    // Create grid cells for each row and column
    for (let r = 0; r < numPianoRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const cell = document.createElement("div");
            cell.classList.add("piano-cell");
            cell.dataset.col = c;
            cell.dataset.row = r;
            cell.addEventListener("click", () => {
                cell.classList.toggle("active");
                playNoteSound({
                    col: c,
                    row: r
                });
            });
            grid.appendChild(cell);
        }
    }

    // Append the grid to the container
    container.appendChild(grid);

    // If the current pattern has saved piano roll notes, mark them active
    const pattern = project.patterns.find(p => p.id === currentEditingPatternId);
    if (pattern && pattern.notes) {
        pattern.notes.forEach(note => {
            // Recalculate column based on note startTime and resolution
            const col = Math.round(note.startTime * COLUMNS_PER_SECOND);
            const row = numPianoRows - 1 - (noteNameToNumber(note.noteName) - lowestPitch);
            const selector = `.piano-cell[data-col="${col}"][data-row="${row}"]`;
            const cell = grid.querySelector(selector);
            if (cell) cell.classList.add("active");
        });
    }
}

function updatePatternsListUI() {
    const list = document.getElementById("patternsList");
    list.innerHTML = "";
    project.patterns.forEach(pattern => {
        const div = document.createElement("div");
        div.className = "pattern-item";
        div.textContent = pattern.name;
        div.dataset.patternId = pattern.id;
        div.setAttribute("draggable", "true");
        div.addEventListener("click", () => openPatternPopup(pattern.id));
        div.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", pattern.id);
        });
        div.addEventListener("dragend", () => {
            div.classList.remove("dragging");
        });
        list.appendChild(div);
    });
}

function updateTimelineUI() {
    const timeline = document.getElementById("timeline");
    timeline.innerHTML = "";
    project.timeline.forEach(item => {
        const pattern = project.patterns.find(p => p.id === item.patternId);
        if (!pattern) return;
        const div = document.createElement("div");
        div.className = "timeline-item";
        div.textContent = pattern.name;
        div.dataset.timelineId = item.id;
        div.style.left = (item.startTime * 100) + "px";
        div.style.top = (item.track * ROW_HEIGHT) + "px";
        const itemLength = item.length !== undefined ? item.length : (pattern.length && pattern.length > 0 ? pattern.length : 1);
        div.style.width = (itemLength * 100) + "px";
        enableTimelineItemDrag(div, item);
        enableTimelineItemResize(div, item);
        div.addEventListener("contextmenu", e => {
            e.preventDefault();
            div.style.opacity = "0";
            setTimeout(() => {
                removeTimelineItem(div.dataset.timelineId);
            }, 150);
        });
        timeline.appendChild(div);
    });
    updateTracklistLength();
    updateTimelineMarkers();
}

function updateTracklistLength() {
    let maxTime = 0;
    project.timeline.forEach(item => {
        const pattern = project.patterns.find(p => p.id === item.patternId);
        if (pattern) {
            const endTime = item.startTime + pattern.length;
            if (endTime > maxTime) maxTime = endTime;
        }
    });
    document.getElementById("tracklistLength").textContent = formatTime(maxTime);
}

function enableTimelineItemResize(itemElem, timelineItem) {
    const resizer = document.createElement("div");
    resizer.classList.add("timeline-item-resizer");
    itemElem.appendChild(resizer);

    let isResizing = false;
    let startX;
    let startWidth;

    resizer.addEventListener("mousedown", function(e) {
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startWidth = parseFloat(itemElem.style.width);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    function onMouseMove(e) {
        if (!isResizing) return;
        let deltaX = e.clientX - startX;
        let newWidth = startWidth + deltaX;
        if (newWidth < 20) newWidth = 20;
        itemElem.style.width = newWidth + "px";
        timelineItem.length = newWidth / 100;
        updateTracklistLength();
        autoSaveProject();
    }

    function onMouseUp(e) {
        if (isResizing) {
            isResizing = false;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        }
    }
}


function formatTime(seconds) {
    let minutes = Math.floor(seconds / 60);
    let secs = Math.floor(seconds % 60);
    let ms = Math.floor((seconds - Math.floor(seconds)) * 100);
    return String(minutes).padStart(2, '0') + ":" + String(secs).padStart(2, '0') + ":" + String(ms).padStart(2, '0');
}

function enableTimelineItemDrag(itemElem, timelineItem) {
    let startX = 0,
        startY = 0,
        initialLeft = 0,
        initialTop = 0;

    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        itemElem.style.left = newLeft + "px";
        itemElem.style.top = newTop + "px";
    }

    function onMouseUp(e) {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        const newLeft = parseFloat(itemElem.style.left);
        const newTop = parseFloat(itemElem.style.top);
        timelineItem.startTime = newLeft / 100;
        timelineItem.track = Math.round(newTop / ROW_HEIGHT);
        updateTimelineUI();
        autoSaveProject();
    }
    itemElem.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        itemElem.style.zIndex = highestPatternZ + 1;
        highestPatternZ += 1;
        initialLeft = parseFloat(itemElem.style.left) || 0;
        initialTop = parseFloat(itemElem.style.top) || 0;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });
}

function removeTimelineItem(timelineId) {
    project.timeline = project.timeline.filter(item => item.id !== timelineId);
    updateTimelineUI();
    autoSaveProject();
}

function setupTimelineDrop() {
    const timeline = document.getElementById("timeline");
    timeline.addEventListener("dragover", (e) => {
        e.preventDefault();
    });
    timeline.addEventListener("drop", (e) => {
        e.preventDefault();
        const patternId = e.dataTransfer.getData("text/plain");
        const rect = timeline.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        const startTime = offsetX / 100;
        const track = Math.round(offsetY / ROW_HEIGHT);
        const pattern = project.patterns.find(p => p.id === patternId);
        const defaultLength = (pattern && pattern.length && pattern.length > 0) ? pattern.length : 1;

        project.timeline.push({
            id: "tl_" + timelineItemCounter++,
            patternId,
            startTime,
            track,
            length: defaultLength
        });
        updateTimelineUI();
        autoSaveProject();
    });
}

function populatePopupMenu() {
    const menuItems = document.querySelectorAll(".popup-menu li");
    menuItems.forEach(li => {
        li.classList.remove("active");
        li.addEventListener("click", () => {
            menuItems.forEach(item => item.classList.remove("active"));
            li.classList.add("active");
            populatePopupContent(li.dataset.category);
        });
    });
    if (menuItems.length > 0) {
        menuItems[0].classList.add("active");
        populatePopupContent(menuItems[0].dataset.category);
    }
}

function populatePopupContent(category) {
    const content = document.querySelector(".popup-content");
    content.innerHTML = "";

    const currentPattern = project.patterns.find(p => p.id === currentEditingPatternId);

    let sounds = [];
    if (category === "Custom") {
        const uploadBtn = document.createElement("button");
        uploadBtn.textContent = "Upload Custom Sound";
        uploadBtn.className = "upload-btn";
        uploadBtn.addEventListener("click", () => {
            document.getElementById("customFileInput").click();
        });
        content.appendChild(uploadBtn);
        sounds = availableSounds.custom;
    } else if (category === "More") {
        content.innerHTML = `<div class="more-content">
      <p>Want more sounds than my stupid and boring library? Check out <a href="https://freesound.org" target="_blank">Freesound.org</a> or other websites :)</p>
      </div>`;
        return;
    } else if (category === "Drums") {
        sounds = availableSounds.drums;
    } else {
        sounds = availableSounds[category.toLowerCase()] || [];
    }
    sounds.forEach(sound => {
        const item = document.createElement("div");
        item.className = "sound-item";
        item.textContent = sound.split("/").pop();
        item.dataset.soundPath = sound;

        if (currentPattern && currentPattern.sounds && currentPattern.sounds.includes(sound)) {
            item.classList.add("selected");
        }

        item.addEventListener("click", () => {
            item.classList.toggle("selected");
            const preview = new Audio(sound);
            preview.volume = 0.5;
            preview.play();
        });
        content.appendChild(item);
    });
}

function openPatternPopup(patternId) {
    currentEditingPatternId = patternId;
    const modal = document.getElementById("patternPopup");
    modal.style.display = "block";
    const pattern = project.patterns.find(p => p.id === patternId);
    if (pattern) {
        document.getElementById("patternNameInput").value = pattern.name;
        document.getElementById("volumeSlider").value = pattern.volume !== undefined ? pattern.volume : 1;
    }
    populatePopupMenu();
}

function savePatternDesign() {
    const selectedItems = document.querySelectorAll(".popup-content .sound-item.selected");
    const selectedSounds = Array.from(selectedItems).map(item => item.dataset.soundPath);
    const pattern = project.patterns.find(p => p.id === currentEditingPatternId);
    if (pattern) {
        pattern.name = document.getElementById("patternNameInput").value || pattern.name;
        pattern.volume = parseFloat(document.getElementById("volumeSlider").value);
        pattern.sounds = selectedSounds;
    }
    closePatternPopup();
}

function closePatternPopup() {
    document.getElementById("patternPopup").style.display = "none";
    currentEditingPatternId = null;
    updatePatternsListUI();
    autoSaveProject();
}

function createNewPattern() {
    const newId = "pattern_" + Date.now();
    const newPattern = {
        id: newId,
        name: "Pattern " + (project.patterns.length + 1),
        sounds: [],
        volume: 1,
        length: 1
    };
    project.patterns.push(newPattern);
    updatePatternsListUI();
    openPatternPopup(newId);
    autoSaveProject();
}

function removeCurrentPattern() {
    project.patterns = project.patterns.filter(p => p.id !== currentEditingPatternId);
    project.timeline = project.timeline.filter(item => item.patternId !== currentEditingPatternId);
    closePatternPopup();
    updatePatternsListUI();
    updateTimelineUI();
    autoSaveProject();
}

function openSelectionPopup(text, button1, b1function) {
    const spopup = document.getElementById('selectionPopup');
    const spcontent = document.getElementById('sp-content');
    const sptext = document.getElementById('sp-text');
    const spclose = document.getElementById('sp-close');

    if (!spopup || !sptext || !spcontent) return;

    spopup.style.display = 'block';
    sptext.textContent = text || '';

    const existingButtons = spopup.querySelectorAll('.hl-button');
    existingButtons.forEach(button => button.remove());

    if (button1) {
        const spb1 = document.createElement("button");
        spb1.classList.add('hl-button');
        spb1.classList.add('red-button');
        spb1.innerHTML = button1;
        spb1.addEventListener("click", () => {
            b1function();
            spopup.style.display = 'none';
        });
        spcontent.appendChild(spb1);
    }

    if (!spclose) return;

    spclose.addEventListener("click", () => {
        spopup.style.display = 'none';
    })
}

window.addEventListener("DOMContentLoaded", (e) => {
    document.getElementById("bpmInput").addEventListener("change", function(e) {
        const newBPM = parseFloat(e.target.value);
        if (!isNaN(newBPM) && newBPM > 0) {
            currentBPM = newBPM;
            updateTimelineMarkers();
        }
    });

    const errr = document.getElementById("errorPopup");

    if (e.target === errr) {
        errr.style.display = "none";
    }

    document.querySelector(".close-error").addEventListener("click", () => {
        document.getElementById("errorPopup").style.display = "none";
    });

    const fileMenu = document.getElementById("fileMenu");
    document.getElementById("fileMenuButton").addEventListener("mouseenter", () => {
        fileMenu.style.display = "block";
    });
    fileMenu.addEventListener("mouseleave", () => {
        fileMenu.style.display = "none";
    });

    document.getElementById("timelinePanel").addEventListener("wheel", function(e) {
        e.preventDefault();
        this.scrollLeft += e.deltaY;
    });

    document.getElementById("openFileBtn").addEventListener("click", () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "application/json";
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                openProjectFile(e.target.files[0]);
            }
        };
        fileInput.click();
    });
    document.getElementById("pianoRollEditorBtn").addEventListener("click", openPianoRollPopup);
    document.getElementById("closePianoRoll").addEventListener("click", closePianoRollPopup);
    document.getElementById("savePianoRollBtn").addEventListener("click", savePianoRollEditor);
    document.getElementById("downloadProjectBtn").addEventListener("click", downloadProject);
    document.getElementById("resetProjectBtn").addEventListener("click", () => {
        openSelectionPopup("This action cannot be undone.", "Reset project", resetProject);
    });
    document.getElementById("docsButton").addEventListener("click", () => {
        window.open('https://github.com/sippedaway/DAW-Online', '_blank');
    });
    document.getElementById("playButton").addEventListener("click", playProject);
    document.getElementById("stopButton").addEventListener("click", stopPlayback);
    document.getElementById("newPatternBtn").addEventListener("click", createNewPattern);
    document.querySelector(".modal .close").addEventListener("click", closePatternPopup);
    document.getElementById("savePatternBtn").addEventListener("click", savePatternDesign);
    document.getElementById("removePatternBtn").addEventListener("click", () => {
        openSelectionPopup("This action cannot be undone...", "Remove pattern", removeCurrentPattern);
    });
    document.getElementById("exportMP3Btn").addEventListener("click", exportProjectAsMP3);
    document.getElementById("exportWAVBtn").addEventListener("click", exportProjectAsWAV);
    setupTimelineDrop();
    autosaveTimer = setInterval(autoSaveProject, 5000);
    loadProjectFromCookie();
});

function openPianoRollPopup() {
    const modal = document.getElementById("pianoRollPopup");
    modal.style.display = "block";
    populatePianoRoll();
}

// Close the Piano Roll modal
function closePianoRollPopup() {
    const modal = document.getElementById("pianoRollPopup");
    modal.style.display = "none";
}

function populatePianoRoll() {
    const container = document.getElementById("pianoRollContainer");
    const notesContainer = document.getElementById("pianoRollNotes");
    const timeMarkersContainer = document.getElementById("pianoRollTimeMarkers");
    // Clear existing content
    container.innerHTML = "";
    notesContainer.innerHTML = "";
    timeMarkersContainer.innerHTML = "";

    const lowestPitch = 48;
    // Define the piano roll duration and resolution
    const PIANO_ROLL_DURATION = 10; // seconds
    const COLUMNS_PER_SECOND = 8;
    const numCols = PIANO_ROLL_DURATION * COLUMNS_PER_SECOND; // 80 columns total
    const numPianoRows = 24; // Number of note rows

    // Create a grid container for the cells
    const grid = document.createElement("div");
    grid.classList.add("piano-grid");
    // Dynamically set the grid's width and height
    grid.style.width = `${numCols * 12.5}px`;
    grid.style.height = `${numPianoRows * 40}px`;

    // Create time markers: one marker every second (aligned with the grid columns)
    for (let c = 0; c < numCols; c++) {
        const timeMarker = document.createElement("div");
        // Place a marker every 8 columns (1 second)
        if (c % COLUMNS_PER_SECOND === 0) {
            timeMarker.textContent = (c / COLUMNS_PER_SECOND).toFixed(0);
            timeMarker.style.textAlign = "center";
            timeMarker.style.fontSize = "12px";
            timeMarker.style.color = "#333";
        }
        timeMarkersContainer.appendChild(timeMarker);
    }

    // Create note labels (from highest pitch at the top)
    for (let r = 0; r < numPianoRows; r++) {
        let pitch = lowestPitch + (numPianoRows - 1 - r);
        let noteName = noteNumberToName(pitch);
        const noteLabel = document.createElement("div");
        noteLabel.textContent = noteName;
        notesContainer.appendChild(noteLabel);
    }

    // Create grid cells for each row and column
    for (let r = 0; r < numPianoRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const cell = document.createElement("div");
            cell.classList.add("piano-cell");
            cell.dataset.col = c;
            cell.dataset.row = r;
            cell.addEventListener("click", () => {
                cell.classList.toggle("active");
                playNoteSound({
                    col: c,
                    row: r
                });
            });
            grid.appendChild(cell);
        }
    }

    // Append the grid to the container
    container.appendChild(grid);

    // If the current pattern has saved piano roll notes, mark them active
    const pattern = project.patterns.find(p => p.id === currentEditingPatternId);
    if (pattern && pattern.notes) {
        pattern.notes.forEach(note => {
            // Recalculate column based on note startTime and resolution
            const col = Math.round(note.startTime * COLUMNS_PER_SECOND);
            const row = numPianoRows - 1 - (noteNameToNumber(note.noteName) - lowestPitch);
            const selector = `.piano-cell[data-col="${col}"][data-row="${row}"]`;
            const cell = grid.querySelector(selector);
            if (cell) cell.classList.add("active");
        });
    }
}

function savePianoRollEditor() {
    const container = document.getElementById("pianoRollContainer");
    const activeCells = container.querySelectorAll(".piano-cell.active");
    const pattern = project.patterns.find(p => p.id === currentEditingPatternId);
    if (!pattern) {
        console.error("Pattern not found");
        return;
    }
    const COLUMNS_PER_SECOND = 8; // Use the same resolution as in populatePianoRoll
    let notes = [];
    activeCells.forEach(cell => {
        const col = parseInt(cell.dataset.col);
        const row = parseInt(cell.dataset.row);
        // Each column equals 1/8 second
        const startTime = col / COLUMNS_PER_SECOND;
        const noteName = noteNumberToName(48 + (numPianoRows - 1 - row));
        notes.push({
            startTime,
            noteName
        });
    });
    pattern.notes = notes;
    closePianoRollPopup();
    autoSaveProject();
}


document.getElementById("customFileInput").addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        const url = URL.createObjectURL(e.target.files[0]);
        availableSounds.custom.push(url);
        const active = document.querySelector(".popup-menu li.active");
        if (active && active.dataset.category === "Custom") {
            populatePopupContent("Custom");
        }
    }
});

document.getElementById("patternPopup").addEventListener("click", function(e) {
    if (e.target === this) {
        closePatternPopup();
    }
});

window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        if (isPlaying) {
            stopPlayback();
        } else {
            playProject();
        }
    }
});

function showErrorMessage(msg) {
    document.getElementById('errorPopup').style.display = 'flex';
    document.getElementById('errormessage').textContent = msg || 'Something went wrong. Please try again.';
}

function updateTimelineMarkers() {
    const markersContainer = document.getElementById("timelineMarkers");
    markersContainer.innerHTML = "";

    let maxTime = 0;
    project.timeline.forEach(item => {
        const pattern = project.patterns.find(p => p.id === item.patternId);
        if (!pattern) return;
        const itemLength = (item.length !== undefined) ? item.length : (pattern.length && pattern.length > 0 ? pattern.length : 1);
        const endTime = item.startTime + itemLength;
        if (endTime > maxTime) maxTime = endTime;
    });

    const totalSeconds = Math.ceil(maxTime) + 1;

    for (let sec = 0; sec <= totalSeconds; sec++) {
        const marker = document.createElement("div");
        marker.className = "timeline-marker";
        marker.style.left = (sec * 100) + "px";

        const label = document.createElement("div");
        label.className = "timeline-marker-label";
        label.textContent = sec;
        label.style.left = (sec * 100 - 10) + "px";

        if (sec !== 0) {
            markersContainer.appendChild(marker);
            markersContainer.appendChild(label);
        }
    }
}