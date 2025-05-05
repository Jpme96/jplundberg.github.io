
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString();
  document.getElementById("clock").textContent = time;
}
setInterval(updateClock, 1000);
updateClock();

const quotes = [
  "Believe you can and you're halfway there.",
  "Do something today that your future self will thank you for.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones."
];
document.getElementById("quote").textContent = quotes[Math.floor(Math.random() * quotes.length)];

function addTask() {
  const taskInput = document.getElementById("taskInput");
  const taskText = taskInput.value.trim();
  if (taskText) {
    const li = document.createElement("li");
    li.textContent = taskText;
    li.onclick = () => li.remove();
    document.getElementById("taskList").appendChild(li);
    taskInput.value = "";
  }
}
