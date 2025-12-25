document.querySelectorAll(".accordion-button").forEach(button => {
    button.addEventListener("click", () => {
        const accordionContent = button.nextElementSibling;

        // Toggle the display of the accordion content
        accordionContent.style.display = (accordionContent.style.display === "block") ? "none" : "block";

        // Optionally, you can change the button text to indicate open/close
        button.textContent = accordionContent.style.display === "block" ? "Hide Leaderboard" : "Show Leaderboard";
    });
});
