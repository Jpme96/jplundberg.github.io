// Update the date every day at midnight
function updateDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  document.getElementById("date").textContent = now.toLocaleDateString(
    "en-US",
    options
  );
}

// Initial call to update the date
updateDate();
updateDateAtMidnight();

// Function to update the date at midnight
function updateDateAtMidnight() {
  const now = new Date();
  const nextMidnight = new Date();
  nextMidnight.setHours(0, 0, 0, 0);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  const timeUntilMidnight = nextMidnight - now;

  setTimeout(() => {
    updateDate();
    setInterval(updateDate, 86400000); // Update every 24 hours
  }, timeUntilMidnight);
}

// Update Clock Function
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  document.getElementById(
    "clock"
  ).textContent = `${hours}:${minutes}:${seconds}`;
}

// Set Dynamic Greeting and Shadow Based on Time of Day
function setGreetingAndShadow() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "";
  let shadowColor = "";
  let musicSource = "";

  // Set the greeting, shadow color, and music track based on specific time ranges
  if (hour >= 0 && hour < 6) {
    greeting = `Good Night, Lundberg 🌙`;
    shadowColor = "2px 2px 10px rgba(0, 0, 255, 1)"; // Dark blue for night
    musicSource = "/cmd/assets/music/night.mp3";
  } else if (hour >= 6 && hour < 12) {
    greeting = `Good Morning, Lundberg 🌅`;
    shadowColor = "2px 2px 10px rgba(255, 223, 0, 1)"; // Light yellow for morning
    musicSource = "/cmd/assets/music/morning.mp3";
  } else if (hour >= 12 && hour < 18) {
    greeting = `Good Afternoon, Lundberg ☀️`;
    shadowColor = "2px 2px 10px rgba(255, 100, 0, 1)"; // Light orange for afternoon
    musicSource = "/cmd/assets/music/afternoon.mp3";
  } else {
    greeting = `Good Evening, Lundberg 🌙`;
    shadowColor = "2px 2px 10px rgba(128, 0, 128, 1)"; // Purple for evening
    musicSource = "/cmd/assets/music/evening.mp3";
  }

  // Set the greeting, shadow, and music dynamically
  document.getElementById("greeting").textContent = greeting;
  document.getElementById("greeting").style.textShadow = shadowColor;
  document.getElementById("clock").style.textShadow = shadowColor;
  document.getElementById("quote").style.textShadow = shadowColor;
  document.getElementById("musicSource").src = musicSource; // Update music source

  // Reload the audio element to apply the new music
  const audio = document.getElementById("music");
  audio.load(); // This ensures the new source is loaded
}

// 100 Random Inspirational Quotes
const quotes = [
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Believe you can and you're halfway there.",
  "It does not matter how slowly you go as long as you do not stop.",
  "You are never too old to set another goal or to dream a new dream.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "Success is not final, failure is not fatal: It is the courage to continue that counts.",
  "Don’t watch the clock; do what it does. Keep going.",
  "Keep your face always toward the sunshine—and shadows will fall behind you.",
  "It always seems impossible until it's done.",
  "The only way to do great work is to love what you do.",
  "You have power over your mind, not outside events. Realize this, and you will find strength.",
  "The happiness of your life depends upon the quality of your thoughts.",
  "Waste no more time arguing about what a good man should be. Be one.",
  "It is not death that a man should fear, but he should fear never beginning to live.",
  "The soul becomes dyed with the color of its thoughts.",
  "He who lives in harmony with himself lives in harmony with the universe.",
  "What we do now echoes in eternity.",
  "If it is not right, do not do it; if it is not true, do not say it.",
  "You are a little soul carrying around a corpse.",
  "How much time he gains who does not look to see what his neighbor says or does or thinks.",
  "A man's worth is no greater than the worth of his ambitions.",
  "The best revenge is to be unlike him who performed the injury.",
  "Be tolerant with others and strict with yourself.",
  "The universe is change; life is judgment.",
  "The art of living is more like wrestling than dancing.",
  // Add more quotes as needed...
];

// Function to pick a random quote
function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  document.getElementById("quote").textContent = quotes[randomIndex];
}

// Toggle play/pause functionality for music
let isMusicPlaying = false;
function toggleMusic() {
  const music = document.getElementById("music");
  const button = document.getElementById("musicButton");

  if (isMusicPlaying) {
    music.pause();
    button.innerHTML = '<i class="fas fa-play-circle"></i>'; // Change button text when paused
  } else {
    music.play().catch((err) => {
      console.error("Error playing audio:", err);
      alert(
        "Audio failed to play. Please allow media playback in your browser settings."
      );
    });
    button.innerHTML = '<i class="fas fa-pause-circle"></i>'; // Change button text when playing
  }
  isMusicPlaying = !isMusicPlaying;
}

// Initial call to set greeting, shadow, and music
setGreetingAndShadow();

// Show first quote when the page loads
window.onload = function () {
  getRandomQuote(); // Display a random quote when the page opens

  // Change quote every 60 seconds (1 minute)
  setInterval(() => {
    getRandomQuote();
  }, 60000); // 60,000 milliseconds = 1 minute
};

function toggleTask() {
  const taskContainer = document.getElementById("taskContainer");
  taskContainer.classList.toggle("open");
  const task = document.getElementById("task");
  task.classList.toggle("open");
  const clock = document.getElementById("clock");
  clock.classList.toggle("small");
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; expires=${expires}; path=/`;
}

function getCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const c of cookies) {
    const [key, value] = c.split("=");
    if (key === name) return decodeURIComponent(value);
  }
  return null;
}

// Update clock every second
setInterval(updateClock, 1000);

// Ensure music plays when the button is clicked
document.addEventListener("DOMContentLoaded", () => {
  setGreetingAndShadow();
  getRandomQuote();
  loadTasks();
  document.getElementById("musicButton").addEventListener("click", toggleMusic);
});

//behaviour for task, delete under here //
document.addEventListener("DOMContentLoaded", () => {
  loadTasks();
});

function addTask() {
  const taskInput = document.getElementById("taskInput");
  let taskText = taskInput.value.trim();

  let tasks = localStorage.getItem("taskList") || "";
  let taskArray = tasks.split(";").filter((task) => task.trim() !== "");

  const editingIndex = taskInput.getAttribute("data-editing-index");
  if (editingIndex !== null) {
    const idx = parseInt(editingIndex, 10);
    if (taskText === "") {
      taskArray.splice(idx, 1);
    } else {
      const domainPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
      if (domainPattern.test(taskText) && !taskText.startsWith("http")) {
        taskText = "https://" + taskText;
      }
      taskArray[idx] = taskText;
    }
    localStorage.setItem("taskList", taskArray.join(";") + (taskArray.length ? ";" : ""));
    taskInput.removeAttribute("data-editing-index");
    taskInput.value = "";
    loadTasks();
    return;
  }

  if (!taskText) return;
  const domainPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
  if (domainPattern.test(taskText) && !taskText.startsWith("http")) {
    taskText = "https://" + taskText;
  }

  taskArray.push(taskText);
  localStorage.setItem("taskList", taskArray.join(";") + (taskArray.length ? ";" : ""));
  taskInput.value = "";
  loadTasks();
}

function loadTasks() {
  const tasks = localStorage.getItem("taskList") || "";
  const taskArray = tasks.split(";").filter((task) => task.trim() !== "");
  const taskList = document.getElementById("taskList");
  taskList.innerHTML = "";

  taskArray.forEach((taskText, index) => {
    const li = document.createElement("li");
    li.classList.add("task-item");

    if (taskText.startsWith("http://") || taskText.startsWith("https://")) {
      const a = document.createElement("a");
      a.href = taskText;
      a.textContent = new URL(taskText).hostname;
      a.target = "_blank";
      li.appendChild(a);
      li.addEventListener("dblclick", () => window.open(taskText, "_blank"));
    } else {
      li.textContent = taskText;
    }

    li.addEventListener("click", () => {
      const taskInput = document.getElementById("taskInput");
      taskInput.value = taskText;
      taskInput.setAttribute("data-editing-index", index);
    });

    taskList.appendChild(li);

    addSwipeHandlers(li, index);
  });
}

// ----- Swipe-to-Delete with Smooth Movement -----
function addSwipeHandlers(task, index) {
  let startX = 0;
  let currentX = 0;
  const deleteThreshold = 100;
  let swipeInProgress = false;

  // Mobile Touch Handling
  task.addEventListener("touchstart", (event) => {
    startX = event.touches[0].clientX;
    task.style.transition = "none";
  });

  task.addEventListener("touchmove", (event) => {
    currentX = event.touches[0].clientX;
    let deltaX = currentX - startX;
    task.style.transform = `translateX(${deltaX}px)`;
  });

  task.addEventListener("touchend", (event) => {
    let deltaX = event.changedTouches[0].clientX - startX;

    if (Math.abs(deltaX) > deleteThreshold) {
      task.style.transition = "transform 0.3s ease-out";
      task.style.transform = `translateX(${deltaX > 0 ? 200 : -200}px)`;
      setTimeout(() => deleteTask(task, index), 300);
    } else {
      task.style.transition = "transform 0.3s ease-out";
      task.style.transform = "translateX(0)";
    }
  });

  // Mouse Handling for Desktop
  task.addEventListener("mousedown", (event) => {
    startX = event.clientX;
    task.style.transition = "none";
    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
  });

  function mouseMoveHandler(event) {
    currentX = event.clientX;
    let deltaX = currentX - startX;
    task.style.transform = `translateX(${deltaX}px)`;
  }

  function mouseUpHandler(event) {
    let deltaX = event.clientX - startX;
    document.removeEventListener("mousemove", mouseMoveHandler);
    document.removeEventListener("mouseup", mouseUpHandler);

    if (Math.abs(deltaX) > deleteThreshold) {
      task.style.transition = "transform 0.3s ease-out";
      task.style.transform = `translateX(${deltaX > 0 ? 200 : -200}px)`;
      setTimeout(() => deleteTask(task, index), 300);
    } else {
      task.style.transition = "transform 0.3s ease-out";
      task.style.transform = "translateX(0)";
    }
  }
}

// ----- Delete Task Function -----
function deleteTask(task, index) {
  let tasks = localStorage.getItem("taskList") || "";
  let taskArray = tasks.split(";").filter((task) => task.trim() !== "");
  taskArray.splice(index, 1);
  localStorage.setItem("taskList", taskArray.join(";") + (taskArray.length ? ";" : ""));
  task.remove();
}




/*Keyboard Event for Enter Key*/
// This event listener allows the user to press Enter to submit the task input
document.getElementById("taskInput").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault(); // Prevents default form submission
    document.getElementById("submitButton").click(); // Simulates button click
    this.blur(); // Hides the keyboard on mobile devices
    //keydelete can delete t here 
    document.addEventListener("keydown", function(event) {
    if (event.key === "Delete") {
        let selectedTask = document.querySelector(".selected"); // Assume tasks have a 'selected' class
        if (selectedTask) {
            selectedTask.remove();
        }
    }
});

  }
});

// Ensure keyboard pops up when input is tapped
document.getElementById("taskInput").addEventListener("focus", function () {
  this.scrollIntoView({ behavior: "smooth", block: "center" });
});


  document.querySelectorAll("#clickable-Card").forEach((card) => {
    card.addEventListener("click", function () {
      this.classList.add("expand"); // Start expansion animation
      this.classList.add("fade-out"); // Start fade-out animation
  
      // Fade out the background
      document.getElementById("container-card").classList.add("fade-out-bg");
  
      // Wait slightly longer before hiding elements
      setTimeout(() => {
        document.getElementById("container-card").style.display = "none"; 
        this.style.display = "none";
      }, 800);
    });
  });
  
