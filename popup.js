let timeLeft = 1500; // 25 minutes
let timerId = null;

// Timer Logic
const display = document.getElementById('timer-display');
const updateDisplay = () => {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

document.getElementById('start').onclick = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    document.getElementById('start').textContent = "RESUME";
  } else {
    timerId = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateDisplay();
      }
    }, 1000);
    document.getElementById('start').textContent = "PAUSE";
  }
};

document.getElementById('reset').onclick = () => {
  clearInterval(timerId);
  timerId = null;
  timeLeft = 1500;
  updateDisplay();
};

// Task Logic
const taskInput = document.getElementById('task-input');
const priorityInput = document.getElementById('priority');
const taskList = document.getElementById('task-list');

const addTask = (text, priority) => {
  const li = document.createElement('li');
  li.className = `task-item ${priority}`;
  li.innerHTML = `<span>[${priority.toUpperCase()}] ${text}</span> <span style="cursor:pointer" onclick="this.parentElement.remove()">✖</span>`;
  taskList.appendChild(li);
};

document.getElementById('add-task').onclick = () => {
  if (taskInput.value) {
    addTask(taskInput.value, priorityInput.value);
    taskInput.value = '';
  }
};
