// ==========================================
// AUTHENTICATION - SIGN UP
// ==========================================

function formatSignupError(error) {

    const errorMessage =
        String(error?.message || error || "");

    if (/confirmation email|email sending|error sending/i.test(errorMessage)) {
        return "Supabase could not send the confirmation email. Email delivery may be unavailable or restricted. Check the project's Authentication email settings, then try again.";
    }

    if (/email address not authorized|recipient.*inactive|inactive.*address/i.test(errorMessage)) {
        return "Supabase could not send email to this address. Its built-in email service only allows approved addresses; the project owner needs to configure email delivery.";
    }

    return errorMessage || "Could not create your account. Please try again.";
}

async function signup() {

    const name =
        document.getElementById("signupName").value.trim();

    const email =
        document.getElementById("signupEmail").value.trim();

    const password =
        document.getElementById("signupPassword").value;

    const message =
        document.getElementById("authMessage");


    if (!name || !email || !password) {

        message.style.color = "#dc2626";
        message.textContent =
            "Please fill in all fields.";

        return;
    }


    if (password.length < 6) {

        message.style.color = "#dc2626";
        message.textContent =
            "Password must be at least 6 characters.";

        return;
    }


    message.style.color = "#6b7280";
    message.textContent =
        "Creating your account...";


    try {
        const { data, error } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {
                    data: {
                        name: name
                    }
                }

            });

        if (error) {

            console.error("Could not create account:", error);
            message.style.color = "#dc2626";
            message.textContent = formatSignupError(error);
            return;
        }

        message.style.color = "#16a34a";

        message.textContent =
            "Account created. Check your email for a confirmation link before signing in.";

        document.getElementById("signupName").value = "";
        document.getElementById("signupEmail").value = "";
        document.getElementById("signupPassword").value = "";
    } catch (error) {

        console.error("Could not create account:", error);
        message.style.color = "#dc2626";
        message.textContent = formatSignupError(error);
    }
}


// ==========================================
// LOGIN
// ==========================================

async function login() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const message =
        document.getElementById("authMessage");


    if (!email || !password) {

        message.style.color = "#dc2626";
        message.textContent =
            "Please enter your email and password.";

        return;
    }


    message.style.color = "#6b7280";
    message.textContent =
        "Logging in...";


    const { data, error } =
        await supabaseClient.auth.signInWithPassword({

            email: email,

            password: password

        });


    if (error) {

        message.style.color = "#dc2626";
        message.textContent =
            error.message;

        return;
    }


    if (data && data.user) {

        await openApp(data.user);

    }

}

function isPasswordRecoveryCallback() {

    const parameters = new URLSearchParams(
        `${window.location.search.slice(1)}&${window.location.hash.slice(1)}`
    );

    return parameters.get("type") === "recovery";
}

function showForgotPassword() {

    document.getElementById("authTabs").classList.add("hidden");
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("signupForm").classList.add("hidden");
    document.getElementById("forgotPasswordForm").classList.remove("hidden");
    document.getElementById("passwordRecoveryForm").classList.add("hidden");
    document.getElementById("loginTab").classList.remove("active");
    document.getElementById("signupTab").classList.remove("active");
    document.getElementById("authMessage").textContent = "";

    const email =
        document.getElementById("loginEmail").value.trim();

    if (email) {
        document.getElementById("resetEmail").value = email;
    }
}

function showPasswordRecovery() {

    document.getElementById("authTabs").classList.add("hidden");
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("signupForm").classList.add("hidden");
    document.getElementById("forgotPasswordForm").classList.add("hidden");
    document.getElementById("passwordRecoveryForm").classList.remove("hidden");
    document.getElementById("loginTab").classList.add("hidden");
    document.getElementById("signupTab").classList.add("hidden");
    document.getElementById("authMessage").textContent = "";
    document.getElementById("authPage").classList.remove("hidden");
    document.getElementById("appPage").classList.add("hidden");

    if (["http:", "https:"].includes(window.location.protocol)) {
        window.history.replaceState(
            null,
            document.title,
            window.location.pathname
        );
    }
}

async function sendPasswordReset() {

    const emailInput =
        document.getElementById("resetEmail");

    const button =
        document.getElementById("sendResetLinkButton");

    const message =
        document.getElementById("authMessage");

    const email = emailInput.value.trim();

    if (!email || !emailInput.validity.valid) {
        message.textContent = "Please enter a valid email address.";
        emailInput.focus();
        return;
    }

    button.disabled = true;
    button.textContent = "Sending...";
    message.style.color = "#6b7280";
    message.textContent = "Sending password reset link...";

    try {
        const currentUrl = new URL(window.location.href);
        currentUrl.hash = "";
        currentUrl.search = "";

        const options = ["http:", "https:"].includes(window.location.protocol)
            ? { redirectTo: currentUrl.toString() }
            : undefined;

        const { error } =
            await supabaseClient.auth.resetPasswordForEmail(email, options);

        if (error) {
            console.error("Could not send password reset email:", error);
            message.style.color = "#dc2626";
            message.textContent = error.message;
            return;
        }

        message.style.color = "#16a34a";
        message.textContent =
            "If an account exists for that email, a password reset link has been sent.";
    } catch (error) {
        console.error("Could not send password reset email:", error);
        message.style.color = "#dc2626";
        message.textContent =
            `Could not send the reset link: ${error.message}`;
    } finally {
        button.disabled = false;
        button.textContent = "Send Reset Link";
    }
}

async function completePasswordRecovery() {

    const passwordInput =
        document.getElementById("recoveryPassword");

    const confirmInput =
        document.getElementById("recoveryPasswordConfirm");

    const button =
        document.getElementById("saveRecoveryPasswordButton");

    const message =
        document.getElementById("authMessage");

    if (passwordInput.value.length < 6) {
        message.style.color = "#dc2626";
        message.textContent = "Password must be at least 6 characters.";
        passwordInput.focus();
        return;
    }

    if (passwordInput.value !== confirmInput.value) {
        message.style.color = "#dc2626";
        message.textContent = "The passwords do not match.";
        confirmInput.focus();
        return;
    }

    button.disabled = true;
    button.textContent = "Updating...";
    message.textContent = "";

    try {
        const { error } =
            await supabaseClient.auth.updateUser({
                password: passwordInput.value
            });

        if (error) {
            console.error("Could not update password from reset link:", error);
            message.style.color = "#dc2626";
            message.textContent = error.message;
            return;
        }

        const { error: signOutError } =
            await supabaseClient.auth.signOut();

        if (signOutError) {
            console.error(
                "Password was updated, but the recovery session could not be ended:",
                signOutError
            );
        }

        passwordRecoveryCallback = false;
        passwordInput.value = "";
        confirmInput.value = "";
        showLogin();
        message.style.color = "#16a34a";
        message.textContent = signOutError
            ? "Password updated, but the recovery session could not be ended. Sign out before using the new password."
            : "Password updated. You can now sign in with your new password.";
    } catch (error) {
        console.error("Could not update password from reset link:", error);
        message.style.color = "#dc2626";
        message.textContent =
            `Could not update your password: ${error.message}`;
    } finally {
        button.disabled = false;
        button.textContent = "Update Password";
    }
}


// ==========================================
// LOGOUT
// ==========================================

async function logout() {

    await supabaseClient.auth.signOut();
    currentUser = null;
    transactionCache = null;

    document.getElementById("appPage")
        .classList.add("hidden");

    document.getElementById("authPage")
        .classList.remove("hidden");

    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPassword").value = "";

    showLogin();
}


// ==========================================
// LOGIN / SIGNUP TABS
// ==========================================

function showLogin() {

    document.documentElement.classList.remove("has-restorable-session");

    const authTabs =
        document.getElementById("authTabs");

    const loginForm =
        document.getElementById("loginForm");

    const signupForm =
        document.getElementById("signupForm");

    const forgotPasswordForm =
        document.getElementById("forgotPasswordForm");

    const passwordRecoveryForm =
        document.getElementById("passwordRecoveryForm");

    const loginTab =
        document.getElementById("loginTab");

    const signupTab =
        document.getElementById("signupTab");

    const message =
        document.getElementById("authMessage");


    if (loginForm)
        loginForm.classList.remove("hidden");

    if (authTabs)
        authTabs.classList.remove("hidden");

    if (signupForm)
        signupForm.classList.add("hidden");

    if (forgotPasswordForm)
        forgotPasswordForm.classList.add("hidden");

    if (passwordRecoveryForm)
        passwordRecoveryForm.classList.add("hidden");

    if (loginTab)
        loginTab.classList.add("active");

    if (signupTab)
        signupTab.classList.remove("active");

    if (loginTab)
        loginTab.classList.remove("hidden");

    if (signupTab)
        signupTab.classList.remove("hidden");

    if (message)
        message.textContent = "";
}


function showSignup() {

    const authTabs =
        document.getElementById("authTabs");

    const loginForm =
        document.getElementById("loginForm");

    const signupForm =
        document.getElementById("signupForm");

    const forgotPasswordForm =
        document.getElementById("forgotPasswordForm");

    const passwordRecoveryForm =
        document.getElementById("passwordRecoveryForm");

    const loginTab =
        document.getElementById("loginTab");

    const signupTab =
        document.getElementById("signupTab");

    const message =
        document.getElementById("authMessage");


    if (loginForm)
        loginForm.classList.add("hidden");

    if (authTabs)
        authTabs.classList.remove("hidden");

    if (forgotPasswordForm)
        forgotPasswordForm.classList.add("hidden");

    if (passwordRecoveryForm)
        passwordRecoveryForm.classList.add("hidden");

    if (signupForm)
        signupForm.classList.remove("hidden");

    if (loginTab)
        loginTab.classList.remove("active");

    if (signupTab)
        signupTab.classList.add("active");

    if (loginTab)
        loginTab.classList.remove("hidden");

    if (signupTab)
        signupTab.classList.remove("hidden");

    if (message)
        message.textContent = "";
}


// ==========================================
// GET CURRENT USER
// ==========================================

async function getCurrentUser({ throwOnError = false } = {}) {

    const {
        data,
        error
    } = await supabaseClient.auth.getUser();


    if (error) {

        if (throwOnError) {
            throw error;
        }

        return null;

    }


    return data.user || null;
}


// ==========================================
// OPEN APP
// ==========================================

async function openApp(user) {

    if (!user) {
        return;
    }

    document.documentElement.classList.remove("has-restorable-session");

    if (
        appInitializationPromise &&
        appInitializationUserId === user.id
    ) {
        return appInitializationPromise;
    }

    if (
        initializedAppUserId === user.id &&
        !document.getElementById("appPage")?.classList.contains("hidden")
    ) {
        currentUser = user;
        return;
    }

    appInitializationUserId = user.id;
    appInitializationPromise = initializeApp(user);

    try {
        await appInitializationPromise;
        initializedAppUserId = user.id;
    } finally {
        appInitializationPromise = null;
        appInitializationUserId = null;
    }
}

async function initializeApp(user) {

    currentUser = user;
    const savedTheme =
        user.user_metadata?.theme ||
        localStorage.getItem(`moneytrack-theme-${user.id}`) ||
        "light";
    preferredTheme =
        SUPPORTED_THEMES.includes(savedTheme)
            ? savedTheme
            : "light";
    applyTheme(preferredTheme);
    preferredCurrency =
        SUPPORTED_CURRENCIES.includes(user.user_metadata?.currency)
            ? user.user_metadata.currency
            : "INR";
    preferredDateLocale =
        SUPPORTED_DATE_LOCALES.includes(user.user_metadata?.dateFormat)
            ? user.user_metadata.dateFormat
            : "en-IN";
    updateAmountPlaceholder();

    const authPage =
        document.getElementById("authPage");

    const appPage =
        document.getElementById("appPage");


    if (authPage)
        authPage.classList.add("hidden");

    if (appPage)
        appPage.classList.remove("hidden");


    const name =
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";


    const welcomeText =
        document.getElementById("welcomeText");

    if (welcomeText) {

        welcomeText.textContent =
            `Hi, ${name}`;

    }

    populateProfile(user);
    await loadDatabaseFeatures();
    refreshCategorySelects();
    refreshSavingsGoalSelect();
    updateSavingsGoalAvailability();
    renderCategoryList();


    const todayDate =
        document.getElementById("todayDate");

    if (todayDate) {

        todayDate.textContent =
            new Date().toLocaleDateString(
                preferredDateLocale,
                {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            );

    }


    const transactionDate =
        document.getElementById("transactionDate");

    if (
        transactionDate &&
        !transactionDate.value
    ) {

        transactionDate.value = getLocalISODate();

    }


    initializeReportMonth();
    initializeBudgetMonth();
    initializeRecurringDate();
    renderRecurringTemplates();

    await updateDashboard();

    // Always start on Transaction History
    showView("history");
}


// ==========================================
// PROFILE
// ==========================================

function populateProfile(user) {

    const name =
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

    const profileName =
        document.getElementById("profileName");

    const profileEmail =
        document.getElementById("profileEmail");

    const profileAvatar =
        document.getElementById("profileAvatar");

    const profileMemberSince =
        document.getElementById("profileMemberSince");

    const profileAvatarChoice =
        document.getElementById("profileAvatarChoice");

    const profileCurrency =
        document.getElementById("profileCurrency");

    const profileDateFormat =
        document.getElementById("profileDateFormat");

    const avatar =
        SUPPORTED_AVATARS.includes(user.user_metadata?.avatar)
            ? user.user_metadata.avatar
            : "initials";

    if (profileName) {
        profileName.value = name;
    }

    if (profileEmail) {
        profileEmail.value = user.email || "";
    }

    if (profileAvatar) {
        profileAvatar.textContent =
            avatar === "initials"
                ? name.charAt(0).toUpperCase()
                : avatar;
    }

    if (profileMemberSince) {
        profileMemberSince.value =
            user.created_at
                ? formatDate(user.created_at)
                : "Not available";
    }

    if (profileAvatarChoice) {
        profileAvatarChoice.value = avatar;
    }

    if (profileCurrency) {
        profileCurrency.value = preferredCurrency;
    }

    if (profileDateFormat) {
        profileDateFormat.value = preferredDateLocale;
    }

}

function applyTheme(theme) {

    preferredTheme = theme;
    document.body.dataset.theme = theme;

    if (currentUser) {
        localStorage.setItem(
            `moneytrack-theme-${currentUser.id}`,
            theme
        );
    }

    const lightButton =
        document.getElementById("lightThemeButton");

    const darkButton =
        document.getElementById("darkThemeButton");

    if (lightButton && darkButton) {
        lightButton.classList.toggle("active", theme === "light");
        darkButton.classList.toggle("active", theme === "dark");
        lightButton.setAttribute("aria-pressed", String(theme === "light"));
        darkButton.setAttribute("aria-pressed", String(theme === "dark"));
    }

    refreshChartTheme();
}

async function setThemePreference(theme) {

    const message =
        document.getElementById("profileMessage");

    if (!SUPPORTED_THEMES.includes(theme)) {
        message.textContent = "Please choose a supported theme.";
        message.className = "profile-message error";
        return;
    }

    if (!currentUser) {
        message.textContent = "Your session has expired. Please log in again.";
        message.className = "profile-message error";
        return;
    }

    applyTheme(theme);
    message.textContent = "Saving appearance preference...";
    message.className = "profile-message";

    const { data, error } =
        await supabaseClient.auth.updateUser({
            data: {
                ...currentUser.user_metadata,
                theme
            }
        });

    if (error) {
        console.error("Could not save appearance preference:", error);
        message.textContent =
            `Theme changed for this device, but could not be saved to your account: ${error.message}`;
        message.className = "profile-message error";
        return;
    }

    currentUser = data.user;
    message.textContent = "Appearance preference saved.";
    message.className = "profile-message success";
}

function previewProfileAvatar() {

    const profileAvatar =
        document.getElementById("profileAvatar");

    const profileAvatarChoice =
        document.getElementById("profileAvatarChoice");

    const profileName =
        document.getElementById("profileName");

    if (!profileAvatar || !profileAvatarChoice) {
        return;
    }

    profileAvatar.textContent =
        profileAvatarChoice.value === "initials"
            ? (profileName?.value.trim().charAt(0) || "U").toUpperCase()
            : profileAvatarChoice.value;
}


async function saveProfile() {

    const profileName =
        document.getElementById("profileName");

    const saveButton =
        document.getElementById("saveProfileButton");

    const message =
        document.getElementById("profileMessage");

    const avatar =
        document.getElementById("profileAvatarChoice").value;

    const currency =
        document.getElementById("profileCurrency").value;

    const dateFormat =
        document.getElementById("profileDateFormat").value;

    const theme =
        preferredTheme;

    const name =
        profileName?.value.trim() || "";

    if (!name) {
        message.textContent = "Please enter your name.";
        message.className = "profile-message error";
        profileName?.focus();
        return;
    }

    if (!currentUser) {
        message.textContent = "Your session has expired. Please log in again.";
        message.className = "profile-message error";
        return;
    }

    if (
        !SUPPORTED_CURRENCIES.includes(currency) ||
        !SUPPORTED_DATE_LOCALES.includes(dateFormat) ||
        !SUPPORTED_AVATARS.includes(avatar) ||
        !SUPPORTED_THEMES.includes(theme)
    ) {
        message.textContent = "Please choose supported profile preferences.";
        message.className = "profile-message error";
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    message.textContent = "";

    const { data, error } =
        await supabaseClient.auth.updateUser({
            data: {
                ...currentUser.user_metadata,
                name,
                avatar,
                currency,
                dateFormat,
                theme
            }
        });

    saveButton.disabled = false;
    saveButton.textContent = "Save Profile & Preferences";

    if (error) {
        console.error("Could not update profile:", error);
        message.textContent = error.message;
        message.className = "profile-message error";
        return;
    }

    currentUser = data.user;
    preferredCurrency = currency;
    preferredDateLocale = dateFormat;
    applyTheme(theme);
    updateAmountPlaceholder();
    populateProfile(currentUser);

    const welcomeText =
        document.getElementById("welcomeText");

    if (welcomeText) {
        welcomeText.textContent = `Hi, ${name}`;
    }

    const todayDate =
        document.getElementById("todayDate");

    if (todayDate) {
        todayDate.textContent =
            new Date().toLocaleDateString(
                preferredDateLocale,
                {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            );
    }

    await updateDashboard();

    message.textContent = "Profile and preferences updated successfully.";
    message.className = "profile-message success";
}

async function changePassword() {

    const newPassword =
        document.getElementById("newPassword");

    const confirmPassword =
        document.getElementById("confirmPassword");

    const saveButton =
        document.getElementById("changePasswordButton");

    const message =
        document.getElementById("passwordMessage");

    if (!currentUser) {
        message.textContent = "Your session has expired. Please log in again.";
        message.className = "profile-message error";
        return;
    }

    if (newPassword.value.length < 6) {
        message.textContent = "Password must be at least 6 characters.";
        message.className = "profile-message error";
        newPassword.focus();
        return;
    }

    if (newPassword.value !== confirmPassword.value) {
        message.textContent = "The passwords do not match.";
        message.className = "profile-message error";
        confirmPassword.focus();
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Updating...";
    message.textContent = "";

    const { data, error } =
        await supabaseClient.auth.updateUser({
            password: newPassword.value
        });

    saveButton.disabled = false;
    saveButton.textContent = "Update Password";

    if (error) {
        console.error("Could not update password:", error);
        message.textContent = error.message;
        message.className = "profile-message error";
        return;
    }

    currentUser = data.user;
    document.getElementById("passwordForm").reset();
    message.textContent = "Password updated successfully.";
    message.className = "profile-message success";
}

