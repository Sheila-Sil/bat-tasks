let timeLeft = 1500;
let timerId = null;
let currentPriority = 'med';

// Initialize Timer from Input
const minsInput = document.getElementById('setup-mins');
const display = document.getElementById('timer-display');
const toggleBtn = document.getElementById('timer-toggle');

const updateDisplay = () => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

minsInput.onchange = () => {
    if (!timerId) {
        timeLeft = minsInput.value * 60;
        updateDisplay();
    }
};

toggleBtn.onclick = () => {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        toggleBtn.textContent = "Resume Patrol";
    } else {
        timerId = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateDisplay();
            } else {
                clearInterval(timerId);
                alert("Mission Complete.");
            }
        }, 1000);
        toggleBtn.textContent = "Ceasefire";
    }
};

// Priority Button Logic
document.querySelectorAll('.p-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.p-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPriority = btn.getAttribute('data-p');
    };
});

// Task Logic
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');

const addTask = () => {
    if (!taskInput.value) return;
    
    const li = document.createElement('li');
    li.className = `task-item ${currentPriority}`;
    li.innerHTML = `
        <span>${taskInput.value}</span>
        <span class="delete-btn">✕</span>
    `;
    
    li.querySelector('.delete-btn').onclick = () => li.remove();
    taskList.prepend(li); // Newest missions at top like Tweek
    taskInput.value = '';
};

document.getElementById('add-task').onclick = addTask;
taskInput.onkeypress = (e) => { if(e.key === 'Enter') addTask(); };
