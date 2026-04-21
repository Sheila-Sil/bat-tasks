let timeLeft = 1500;
let timerId = null;
let currentPriority = 'med';

const display = document.getElementById('timer-display');
const slider = document.getElementById('time-slider');
const toggleBtn = document.getElementById('timer-toggle');

// Update timer based on Dial (Slider)
slider.addEventListener('input', () => {
    if (!timerId) {
        timeLeft = slider.value * 60;
        const mins = slider.value.toString().padStart(2, '0');
        display.textContent = `${mins}:00`;
    }
});

toggleBtn.onclick = () => {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        toggleBtn.textContent = "Resume Mission";
        slider.disabled = false;
    } else {
        slider.disabled = true;
        timerId = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                const secs = (timeLeft % 60).toString().padStart(2, '0');
                display.textContent = `${mins}:${secs}`;
            } else {
                clearInterval(timerId);
                alert("Objective Secured.");
            }
        }, 1000);
        toggleBtn.textContent = "Aborting...";
    }
};

// Priority Buttons
document.querySelectorAll('.p-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.p-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPriority = btn.getAttribute('data-p');
    };
});

// Mission Planner Logic
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');

const addTask = () => {
    if (!taskInput.value.trim()) return;

    const li = document.createElement('li');
    li.className = `task-item ${currentPriority}`;
    li.innerHTML = `
        <span>${taskInput.value}</span>
        <span class="delete-task">✕</span>
    `;

    li.querySelector('.delete-task').onclick = () => {
        li.style.opacity = '0';
        setTimeout(() => li.remove(), 200);
    };

    taskList.prepend(li);
    taskInput.value = '';
};

document.getElementById('add-task').onclick = addTask;
taskInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addTask(); });
