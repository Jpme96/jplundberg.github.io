// Clock
function updateClock() {
  const now = new Date();
  const clock = document.getElementById('clock');
  clock.textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// Greeting
const greeting = document.getElementById('greeting');
const hour = new Date().getHours();
if (hour < 12) {
  greeting.textContent = 'Good morning!';
} else if (hour < 18) {
  greeting.textContent = 'Good afternoon!';
} else {
  greeting.textContent = 'Good evening!';
}

// Inspirational Quotes
const quotes = [
  "Believe you can and you're halfway there.",
  "The only way to do great work is to love what you do.",
  "Every moment is a fresh beginning.",
  "Dream big and dare to fail."
];
document.getElementById('quote').textContent =
  quotes[Math.floor(Math.random() * quotes.length)];
