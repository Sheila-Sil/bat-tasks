// ---------- State ----------
let timeLeft = 1500;      // seconds remaining
let totalTime = 1500;     // seconds set on the dial
let timerId = null;
let currentPriority = 'med';

const display = document.getElementById('timer-display');
const slider = document.getElementById('time-slider');
const toggleBtn = document.getElementById('timer-toggle');
const statusLine = document.getElementById('timer-status');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');

// ---------- Storage helpers ----------
const STORAGE_KEY = 'batTasksState';

function saveState() {
    const tasks = Array.from(taskList.children).map(li => ({
        text: li.querySelector('span').textContent,
        priority: [...li.classList].find(c => c !== 'task-item')
    }));
    chrome.storage.local.set({
        [STORAGE_KEY]: {
            tasks,
            dial: slider.value
        }
    });
}

function loadState() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        const state = result[STORAGE_KEY];
        if (!state) return;

        if (state.dial) {
            slider.value = state.dial;
            setDialDisplay(state.dial);
        }
        (state.tasks || []).forEach(t => addTask(t.text, t.priority, false));
    });
}

// ---------- Timer ----------
function setDialDisplay(minutes) {
    timeLeft = minutes * 60;
    totalTime = timeLeft;
    display.textContent = `${minutes.toString().padStart(2, '0')}:00`;
}

function renderTime() {
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    display.textContent = `${mins}:${secs}`;
}

slider.addEventListener('input', () => {
    if (!timerId) {
        setDialDisplay(Number(slider.value));
        saveState();
    }
});

function stopTimer(resetToDial) {
    clearInterval(timerId);
    timerId = null;
    slider.disabled = false;
    display.classList.remove('pulse');
    if (resetToDial) {
        setDialDisplay(Number(slider.value));
        toggleBtn.textContent = 'START MISSION';
        statusLine.textContent = 'STANDING BY';
    } else {
        toggleBtn.textContent = 'RESUME MISSION';
        statusLine.textContent = 'PAUSED';
    }
}

toggleBtn.onclick = () => {
    if (timerId) {
        // Currently running -> pause
        stopTimer(false);
        return;
    }

    // Currently idle or paused -> run
    if (timeLeft <= 0) {
        setDialDisplay(Number(slider.value));
    }
    slider.disabled = true;
    statusLine.textContent = 'MISSION ACTIVE';
    toggleBtn.textContent = 'ABORT MISSION';

    timerId = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            renderTime();
        } else {
            clearInterval(timerId);
            timerId = null;
            slider.disabled = false;
            display.textContent = '00:00';
            display.classList.add('pulse');
            statusLine.textContent = 'OBJECTIVE SECURED';
            toggleBtn.textContent = 'START MISSION';
        }
    }, 1000);
};

// ---------- Priority buttons ----------
document.querySelectorAll('.p-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.p-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPriority = btn.getAttribute('data-p');
    };
});

// ---------- Mission planner ----------
function addTask(text, priority, persist = true) {
    if (!text || !text.trim()) return;

    const li = document.createElement('li');
    li.className = `task-item ${priority}`;
    li.innerHTML = `
        <span>${text}</span>
        <span class="delete-task" aria-label="Remove objective">✕</span>
    `;

    li.querySelector('.delete-task').onclick = () => {
        li.style.opacity = '0';
        setTimeout(() => {
            li.remove();
            saveState();
        }, 200);
    };

    taskList.prepend(li);
    if (persist) saveState();
}

document.getElementById('add-task').onclick = () => {
    addTask(taskInput.value, currentPriority);
    taskInput.value = '';
};
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask(taskInput.value, currentPriority);
        taskInput.value = '';
    }
});

// ---------- Init ----------
loadState();
