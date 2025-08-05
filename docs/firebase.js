// -------------------- Imports --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// -------------------- Config --------------------
const firebaseConfig = {
    apiKey: "AIzaSyCy-ip5bnHfzGw5EqfzcletoCiD7hDQU5U",
    authDomain: "code-alkhayrat.firebaseapp.com",
    projectId: "code-alkhayrat",
    storageBucket: "code-alkhayrat.firebasestorage.app",
    messagingSenderId: "515845287002",
    appId: "1:515845287002:web:92d4cda97a3de2b6177c63",
    measurementId: "G-6W2SLV2PY0"
};

// -------------------- Init Firebase --------------------
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
window.auth = auth; // Expose auth for global access
const db = getFirestore(app);

// -------------------- Login/Logout --------------------
window.login = async function () {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("Logged in as:", user.email);

        // Optional: Save minimal user info for your UI
        localStorage.setItem("userDisplayName", user.displayName);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userPhoto", user.photoURL);
    } catch (error) {
        console.error("Login error:", error);
    }
};

window.logout = async function () {
    try {
        await signOut(auth);
        console.log("User logged out");
        localStorage.clear();
        document.getElementById("user-info").innerHTML = "";
    } catch (error) {
        console.error("Logout error:", error);
    }
};

// -------------------- Restore Session --------------------
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User session restored:", user.email);
        showUser(user);
    } else {
        console.log("No user signed in");
        document.getElementById("user-info").innerHTML = "Not logged in";
        // Clear local storage if no user is signed in
        hideUser();
    }
});

// -------------------- Show/Hide User Info --------------------
function showUser(user) {
    document.getElementById("user-info").innerHTML = `مرحبًا، ${user.displayName}`;
    document.getElementById("user-info").style.display = "block";
}

function hideUser() {
    document.getElementById("user-info").innerHTML = "";
    document.getElementById("user-info").style.display = "none";
}

