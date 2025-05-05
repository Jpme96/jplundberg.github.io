
    // Update the date every day at midnight
    function updateDate() {
      const now = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      document.getElementById('date').textContent = now.toLocaleDateString('en-US', options);
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
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
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
        musicSource = "cmd/assets/music/night.mp3";
      } else if (hour >= 6 && hour < 12) {
        greeting = `Good Morning, Lundberg 🌅`;
        shadowColor = "2px 2px 10px rgba(255, 223, 0, 1)"; // Light yellow for morning
        musicSource = "cmd/assets/music/morning.mp3";
      } else if (hour >= 12 && hour < 18) {
        greeting = `Good Afternoon, Lundberg ☀️`;
        shadowColor = "2px 2px 10px rgba(255, 100, 0, 1)"; // Light orange for afternoon
        musicSource = "cmd/assets/music/afternoon.mp3";
      } else {
        greeting = `Good Evening, Lundberg 🌙`;
        shadowColor = "2px 2px 10px rgba(128, 0, 128, 1)"; // Purple for evening
        musicSource = "cmd/assets/music/evening.mp3";
      }

      // Set the greeting, shadow, and music dynamically
      document.getElementById("greeting").textContent = greeting;
      document.getElementById("greeting").style.textShadow = shadowColor;
      document.getElementById("clock").style.textShadow = shadowColor;
      document.getElementById("quote").style.textShadow = shadowColor;
      document.getElementById("musicSource").src = musicSource; // Update music source

      // Reload the audio element to apply the new music
      const audio = document.getElementById("music");
      audio.load();  // This ensures the new source is loaded
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
      "The art of living is more like wrestling than dancing."
      // Add more quotes as needed...
    ];

    // Function to pick a random quote
    function getRandomQuote() {
      const randomIndex = Math.floor(Math.random() * quotes.length);
      document.getElementById('quote').textContent = quotes[randomIndex];
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
        music.play().catch(err => {
          console.error('Error playing audio:', err);
          alert("Audio failed to play. Please allow media playback in your browser settings.");
        });
        button.innerHTML = '<i class="fas fa-pause-circle"></i>'; // Change button text when playing
      }
      isMusicPlaying = !isMusicPlaying;
    }

    // Initial call to set greeting, shadow, and music
    setGreetingAndShadow();

    // Show first quote when the page loads
    window.onload = function() {
      getRandomQuote();  // Display a random quote when the page opens

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
      document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
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
    document.getElementById("musicButton").addEventListener("click", toggleMusic);

 document.addEventListener("DOMContentLoaded", () => {
  setGreetingAndShadow();
  getRandomQuote();

  // Ensure event listeners are added AFTER elements exist
  document.getElementById("musicButton").addEventListener("click", toggleMusic);
});

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