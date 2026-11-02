// ==========================================
// MAIN APP TAB SWITCHER
// ==========================================
// THIS IS THE IMPORTANT PART
//
// Transaction History button:
// showView("history")
//
// Reports button:
// showView("reports")
//
// Only ONE of the two main sections
// will be visible at a time.
// ==========================================

function showView(view) {

    const views = {
        history: {
            tab: "historyTab",
            section: "historySection"
        },
        budgets: {
            tab: "budgetsTab",
            section: "budgetsSection"
        },
        recurring: {
            tab: "recurringTab",
            section: "recurringSection"
        },
        billReminders: {
            tab: "billRemindersTab",
            section: "billRemindersSection"
        },
        savingsGoals: {
            tab: "savingsGoalsTab",
            section: "savingsGoalsSection"
        },
        categories: {
            tab: "categoriesTab",
            section: "categoriesSection"
        },
        reports: {
            tab: "reportsTab",
            section: "reportsSection"
        },
        profile: {
            tab: "profileTab",
            section: "profileSection"
        }
    };

    if (!views[view]) {
        return;
    }

    Object.values(views).forEach(({ tab, section }) => {
        document.getElementById(tab)?.classList.toggle(
            "active",
            views[view].tab === tab
        );
        document.getElementById(section)?.classList.toggle(
            "hidden",
            views[view].section !== section
        );
    });

    document.getElementById("dashboardSection")?.classList.toggle(
        "hidden",
        view !== "history"
    );

    if (view === "reports") {
        initializeReportMonth();
        updateReports();
    }

    if (view === "budgets") {
        initializeBudgetMonth();
        updateBudgets();
    }

    if (view === "recurring") {
        initializeRecurringDate();
        renderRecurringTemplates();
    }

    if (view === "billReminders") {
        renderBillReminders();
    }

    if (view === "savingsGoals") {
        renderSavingsGoals();
    }

    if (view === "categories") {
        refreshCategorySelects();
        renderCategoryList();
    }

    if (view === "profile" && currentUser) {
        populateProfile(currentUser);
    }

}


// ==========================================
// STARTUP
// ==========================================

async function startup() {

    // Do not leave first-time visitors waiting on Supabase session restore.
    document.documentElement.classList.remove("has-restorable-session");
    document.getElementById("appPage")?.classList.add("hidden");
    document.getElementById("authPage")?.classList.remove("hidden");
    showLogin();

    const isRecovery =
        passwordRecoveryCallback ||
        isPasswordRecoveryCallback();

    let session = null;

    try {
        const sessionPromise = supabaseClient.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error("Session check timed out")), 5000);
        });
        const { data, error } = await Promise.race([
            sessionPromise,
            timeoutPromise
        ]);

        if (error) {
            throw error;
        }

        session = data.session;
    } catch (error) {
        console.error("Could not restore the local session:", error);
        document.documentElement.classList.remove("has-restorable-session");
        showLogin();
        const message =
            document.getElementById("authMessage");
        message.style.color = "#dc2626";
        message.textContent =
            `Could not restore your session: ${error.message}`;
        return;
    }

    const user = session?.user || null;

    if (isRecovery && user) {
        document.documentElement.classList.remove("has-restorable-session");
        passwordRecoveryCallback = true;
        currentUser = user;
        showPasswordRecovery();
        return;
    }

    if (isRecovery && !user) {
        document.documentElement.classList.remove("has-restorable-session");
        showLogin();
        const message =
            document.getElementById("authMessage");
        message.style.color = "#dc2626";
        message.textContent =
            "This reset link is invalid or expired. Request a new password reset link.";
        return;
    }


    if (user) {

        await openApp(user);

    } else {

        const appPage =
            document.getElementById(
                "appPage"
            );

        const authPage =
            document.getElementById(
                "authPage"
            );


        if (appPage) {

            appPage.classList.add(
                "hidden"
            );

        }


        if (authPage) {

            authPage.classList.remove(
                "hidden"
            );

        }


        showLogin();

    }

}


// ==========================================
// AUTH STATE LISTENER
// ==========================================

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (
            event === "PASSWORD_RECOVERY" &&
            session?.user
        ) {
            passwordRecoveryCallback = true;
            currentUser = session.user;
            showPasswordRecovery();
            return;
        }


        if (
            event === "SIGNED_IN" &&
            session?.user
        ) {

            await openApp(session.user);

        }


        if (
            event === "SIGNED_OUT"
        ) {

            document.documentElement.classList.remove("has-restorable-session");
            currentUser = null;
            transactionCache = null;
            initializedAppUserId = null;
            passwordRecoveryCallback = false;

            const appPage =
                document.getElementById(
                    "appPage"
                );

            const authPage =
                document.getElementById(
                    "authPage"
                );


            if (appPage) {

                appPage.classList.add(
                    "hidden"
                );

            }


            if (authPage) {

                authPage.classList.remove(
                    "hidden"
                );

            }

        }

    }
);


// ==========================================
// START APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", startup, { once: true });

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(error => {
            console.warn("Service worker registration failed:", error);
        });
    });
}
