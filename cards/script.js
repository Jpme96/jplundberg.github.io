document.querySelectorAll("#clickable-Card, #clickableCard").forEach(card => {
    card.addEventListener("click", function() {
        this.classList.add("expand"); // Start expansion animation
        
        // Wait for animation to finish before redirecting
        setTimeout(() => {
            window.location.href = "https://www.jplundberg.com/cmd"; // Redirect to your website
        }, 1500); // Increased duration for slower animation
    });
});
