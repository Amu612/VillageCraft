async function fetchJSONData() {
    console.log("Login attempt initiated.");

    // API endpoint
    const url = "https://glsmoodle.in/vaat/login.php";

    // Retrieve username and password from input fields
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // Prepare POST parameters
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);

    try {
        // Make POST request to the login endpoint
        const response = await fetch(url, {
            method: "POST", // HTTP method
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            mode: "cors", // Enable CORS
            body: params.toString(), // Serialize parameters
        });

        // Parse response
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Fetched Data:", data);

        // Validate the response
        if (data.code === '200') {
            // Login success, redirect to menu
            localStorage.setItem("username",username);
            localStorage.setItem("user_id",data.user_id);
            window.location.href = "menu.html";
            console.log(user_id);
        } else {
            // Login failed, show error message
            displayErrorMessage("Invalid username or password.");
        }
    } catch (error) {
        console.error("Error during login request:", error);
        displayErrorMessage("Failed to connect to the server. Please try again.");
    }
}

// Function to display error message
function displayErrorMessage(message) {
    const errorMessage = document.getElementById("error-message");
    if (!errorMessage) {
        console.error("Error message container not found in DOM.");
        return;
    }
    errorMessage.style.display = "block";
    errorMessage.innerText = message;
}

// Attach event listener to the login button
document.getElementById("login").addEventListener("click", fetchJSONData);
