async function loadDatabaseFeatures() {
    if (!currentUser) return;
    const [budgets, recurring, goals, categories] = await Promise.all([
        supabaseClient.from("budgets").select("*").eq("user_id", currentUser.id),
        supabaseClient.from("recurring_templates").select("*").eq("user_id", currentUser.id),
        supabaseClient.from("savings_goals").select("*").eq("user_id", currentUser.id),
        supabaseClient.from("custom_categories").select("*").eq("user_id", currentUser.id)
    ]);
    if ([budgets.error, recurring.error, goals.error, categories.error].some(Boolean)) {
        databaseFeaturesLoaded = false;
        return;
    }
    databaseBudgets = budgets.data || [];
    databaseRecurringTemplates = (recurring.data || []).map(template => ({
        ...template,
        nextDate: template.next_date,
        pendingDate: template.pending_date,
        reminderDays: template.reminder_days,
        dayOfMonth: template.day_of_month
    }));
    databaseSavingsGoals = goals.data || [];
    databaseCustomCategories = categories.data || [];
    databaseFeaturesLoaded = true;
}

// ==========================================
// GET TRANSACTIONS
// ==========================================

async function getTransactions({ throwOnError = false, force = false } = {}) {

    if (!force && transactionCache !== null) {
        return transactionCache;
    }

    const user = currentUser ||
        await getCurrentUser({ throwOnError });


    if (!user) {

        if (throwOnError) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        return [];

    }


    const {
        data,
        error
    } = await supabaseClient

        .from("transactions")

        .select("*")

        .eq("user_id", user.id)

        .order("date", {
            ascending: false
        });


    if (error) {

        console.error(
            "Could not load transactions:",
            error
        );

        if (throwOnError) {
            throw error;
        }

        return [];

    }


    transactionCache = data || [];
    return transactionCache;
}

function initializeBudgetMonth() {

    const monthInput =
        document.getElementById("budgetMonth");

    if (monthInput && !monthInput.value) {
        const now = new Date();
        monthInput.value =
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
}

function getBudgetLimits() {

    const monthInput = document.getElementById("budgetMonth")?.value;
    if (databaseFeaturesLoaded) {
        const month = monthInput
            ? `${monthInput}-01`
            : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
        return Object.fromEntries(databaseBudgets
            .filter(budget => String(budget.month).slice(0, 10) === month)
            .map(budget => [budget.category, Number(budget.amount)])
            .filter(([category, amount]) => getBudgetCategories().includes(category) && amount > 0));
    }

    const savedBudgets =
        currentUser?.user_metadata?.budgets;

    if (
        !savedBudgets ||
        typeof savedBudgets !== "object" ||
        Array.isArray(savedBudgets)
    ) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(savedBudgets).filter(
            ([category, limit]) =>
                getBudgetCategories().includes(category) &&
                Number.isFinite(Number(limit)) &&
                Number(limit) > 0
        ).map(
            ([category, limit]) =>
                [category, Number(limit)]
        )
    );
}

function getLocalISODate(date = new Date()) {

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isValidISODate(value) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

function advanceRecurringDate(dateValue, frequency, preferredDay) {

    const date = new Date(`${dateValue}T00:00:00Z`);

    if (frequency === "weekly") {
        date.setUTCDate(date.getUTCDate() + 7);
    } else {
        const day = Number.isInteger(preferredDay)
            ? preferredDay
            : date.getUTCDate();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + 1);
        const lastDay = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
        ).getUTCDate();
        date.setUTCDate(Math.min(day, lastDay));
    }

    return date.toISOString().slice(0, 10);
}

function getRecurringTemplates() {

    if (databaseFeaturesLoaded) {
        return databaseRecurringTemplates.filter(template =>
            template && ["expense", "income"].includes(template.type) &&
            Number(template.amount) > 0 && isValidISODate(template.nextDate)
        ).map(template => ({
            id: String(template.id),
            type: template.type,
            amount: Number(template.amount),
            category: template.category,
            description: String(template.description || "-"),
            frequency: template.frequency,
            nextDate: template.nextDate,
            pendingDate: template.pendingDate || undefined,
            reminderDays: Number(template.reminderDays || 0),
            dayOfMonth: template.dayOfMonth || Number(template.nextDate.slice(-2))
        }));
    }

    const saved =
        currentUser?.user_metadata?.recurringTransactions;

    if (!Array.isArray(saved)) {
        return [];
    }

    return saved.filter(template =>
        template &&
        typeof template.id === "string" &&
        ["expense", "income"].includes(template.type) &&
        Number.isFinite(Number(template.amount)) &&
        Number(template.amount) > 0 &&
        getTransactionCategories().includes(template.category) &&
        RECURRING_FREQUENCIES.includes(template.frequency) &&
        isValidISODate(template.nextDate) &&
        (!template.pendingDate || isValidISODate(template.pendingDate))
    ).map(template => ({
        id: template.id,
        type: template.type,
        amount: Number(template.amount),
        category: template.category,
        description: String(template.description || "-"),
        frequency: template.frequency,
        nextDate: template.nextDate,
        reminderDays: [0, 1, 3, 7].includes(Number(template.reminderDays))
            ? Number(template.reminderDays)
            : 3,
        dayOfMonth: Number.isInteger(template.dayOfMonth) &&
            template.dayOfMonth >= 1 &&
            template.dayOfMonth <= 31
                ? template.dayOfMonth
                : Number(template.nextDate.slice(-2)),
        ...(template.pendingDate
            ? { pendingDate: template.pendingDate }
            : {})
    }));
}

async function saveRecurringTemplates(templates) {

    if (!currentUser) {
        throw new Error("Your session has expired. Please log in again.");
    }

    let savedTemplates = templates;
    if (databaseFeaturesLoaded) {
        await supabaseClient.from("recurring_templates").delete().eq("user_id", currentUser.id);
        const rows = templates.map(template => ({
            user_id: currentUser.id,
            type: template.type,
            category: template.category,
            amount: template.amount,
            description: template.description || "-",
            frequency: template.frequency,
            next_date: template.nextDate,
            day_of_month: template.dayOfMonth,
            reminder_days: template.reminderDays,
            pending_date: template.pendingDate || null
        }));
        const { data, error } = await supabaseClient.from("recurring_templates")
            .insert(rows).select("*");
        if (error) throw error;
        databaseRecurringTemplates = data || [];
        savedTemplates = data.map(template => ({
            id: template.id,
            type: template.type,
            category: template.category,
            amount: Number(template.amount),
            description: template.description,
            frequency: template.frequency,
            nextDate: template.next_date,
            dayOfMonth: template.day_of_month,
            reminderDays: template.reminder_days,
            ...(template.pending_date ? { pendingDate: template.pending_date } : {})
        }));
    }

    const { data, error } = await supabaseClient.auth.updateUser({
        data: { ...currentUser.user_metadata, recurringTransactions: savedTemplates }
    });
    if (error) throw error;
    currentUser = data.user;
}

function initializeRecurringDate() {

    const input =
        document.getElementById("recurringNextDate");

    if (input && !input.value) {
        input.value = getLocalISODate();
    }
}

async function saveRecurringTemplate() {

    const form =
        document.getElementById("recurringForm");

    const button =
        document.getElementById("saveRecurringButton");

    const message =
        document.getElementById("recurringMessage");

    const type =
        document.getElementById("recurringType").value;

    const amount =
        Number(document.getElementById("recurringAmount").value);

    const category =
        document.getElementById("recurringCategory").value;

    const frequency =
        document.getElementById("recurringFrequency").value;

    const nextDate =
        document.getElementById("recurringNextDate").value;

    const reminderDays =
        type === "expense"
            ? Number(document.getElementById("recurringReminderDays").value)
            : 0;

    const description =
        document.getElementById("recurringDescription").value.trim() || "-";

    if (!currentUser) {
        message.textContent = "Your session has expired. Please log in again.";
        message.className = "profile-message error";
        return;
    }

    if (
        !["expense", "income"].includes(type) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !getTransactionCategories().includes(category) ||
        !RECURRING_FREQUENCIES.includes(frequency) ||
        ![0, 1, 3, 7].includes(reminderDays) ||
        !isValidISODate(nextDate)
    ) {
        message.textContent =
            "Enter a valid amount, category, repeat schedule, and first due date.";
        message.className = "profile-message error";
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";
    message.textContent = "";
    message.className = "profile-message";

    try {
        const templates = getRecurringTemplates();
        templates.push({
            id: makeLocalId(),
            type,
            amount,
            category,
            description,
            frequency,
            nextDate,
            reminderDays,
            dayOfMonth: Number(nextDate.slice(-2))
        });

        await saveRecurringTemplates(templates);
        form.reset();
        initializeRecurringDate();
        renderRecurringTemplates();
        message.textContent =
            type === "expense" && reminderDays > 0
                ? "Recurring item saved. MoneyTrack will remind you in the app and ask you to confirm it when due."
                : "Recurring item saved. MoneyTrack will ask you to confirm it when due.";
        message.className = "profile-message success";
    } catch (error) {
        console.error("Could not save recurring item:", error);
        message.textContent =
            `Could not save recurring item: ${error.message}`;
        message.className = "profile-message error";
    } finally {
        button.disabled = false;
        button.textContent = "Save recurring item";
    }
}

function renderRecurringTemplates() {

    const list =
        document.getElementById("recurringList");

    const empty =
        document.getElementById("recurringEmptyMessage");

    if (!list || !empty) {
        return;
    }

    const templates = getRecurringTemplates();
    const today = getLocalISODate();

    list.replaceChildren();
    empty.classList.toggle("hidden", templates.length > 0);

    templates.forEach(template => {

        const dueDate = template.pendingDate || template.nextDate;
        const daysUntil = daysUntilISO(today, dueDate);
        const dueNow = daysUntil <= 0;
        const needsReminder =
            template.type === "expense" &&
            template.reminderDays > 0 &&
            daysUntil <= template.reminderDays;
        const card = document.createElement("article");
        card.className =
            `recurring-card${dueNow ? " recurring-card-due" : needsReminder ? " recurring-card-reminder" : ""}`;

        const details = document.createElement("div");
        details.className = "recurring-card-details";

        const title = document.createElement("h3");
        title.textContent = template.description === "-"
            ? template.category
            : template.description;

        const kind = document.createElement("span");
        kind.className = template.type === "income"
            ? "income-text"
            : "expense-text";
        kind.textContent =
            `${template.type === "income" ? "Income" : "Expense"} Â· ${template.category}`;

        const schedule = document.createElement("p");
        schedule.textContent =
            `${template.frequency === "weekly" ? "Weekly" : "Monthly"} Â· ` +
            `${template.pendingDate ? "Confirmation pending" : `Next due ${formatDate(template.nextDate)}`}` +
            (template.type === "expense" && template.reminderDays > 0
                ? ` Â· Reminder ${template.reminderDays} ${template.reminderDays === 1 ? "day" : "days"} before`
                : "");

        const amount = document.createElement("strong");
        amount.textContent = formatMoney(template.amount);
        details.append(title, kind, schedule);

        const actions = document.createElement("div");
        actions.className = "recurring-card-actions";

        if (dueNow) {
            const confirmButton = document.createElement("button");
            confirmButton.type = "button";
            confirmButton.className = "primary-btn recurring-confirm-btn";
            confirmButton.dataset.recurringId = template.id;
            confirmButton.textContent = template.pendingDate
                ? "Retry adding"
                : "Review & add";
            confirmButton.addEventListener(
                "click",
                () => confirmRecurringOccurrence(template.id)
            );
            actions.appendChild(confirmButton);
        }

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "budget-remove-btn";
        removeButton.textContent = "Remove";
        removeButton.addEventListener(
            "click",
            () => removeRecurringTemplate(template.id)
        );
        actions.appendChild(removeButton);

        const amountArea = document.createElement("div");
        amountArea.className = "recurring-card-amount";
        amountArea.append(amount, actions);
        card.append(details, amountArea);
        list.appendChild(card);
    });

    renderBillReminders();
}

function daysUntilISO(fromDate, toDate) {
    const from = new Date(`${fromDate}T00:00:00Z`);
    const to = new Date(`${toDate}T00:00:00Z`);
    return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function renderBillReminders() {

    const list = document.getElementById("billReminderList");
    const empty = document.getElementById("billReminderEmpty");

    if (!list || !empty) {
        return;
    }

    const today = getLocalISODate();
    const reminders = getRecurringTemplates()
        .filter(template => {
            if (template.type !== "expense" || template.reminderDays <= 0) {
                return false;
            }
            const dueDate = template.pendingDate || template.nextDate;
            return daysUntilISO(today, dueDate) <= template.reminderDays;
        })
        .sort((left, right) =>
            (left.pendingDate || left.nextDate)
                .localeCompare(right.pendingDate || right.nextDate)
        );

    list.replaceChildren();
    empty.classList.toggle("hidden", reminders.length > 0);

    reminders.forEach(template => {
        const dueDate = template.pendingDate || template.nextDate;
        const daysUntil = daysUntilISO(today, dueDate);
        const item = document.createElement("article");
        item.className = `bill-reminder-item${daysUntil <= 0 ? " bill-reminder-overdue" : ""}`;

        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = template.description === "-"
            ? template.category
            : template.description;
        const date = document.createElement("span");
        date.textContent = daysUntil < 0
            ? `Overdue Â· ${formatDate(dueDate)}`
            : daysUntil === 0
                ? "Due today"
                : `Due in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`;
        details.append(title, date);

        const amount = document.createElement("strong");
        amount.className = "bill-reminder-amount";
        amount.textContent = formatMoney(template.amount);

        const paidButton = document.createElement("button");
        paidButton.type = "button";
        paidButton.className = "secondary-btn bill-paid-btn";
        paidButton.textContent = "Mark paid";
        paidButton.addEventListener("click", () => confirmRecurringOccurrence(template.id));
        item.append(details, amount, paidButton);
        list.appendChild(item);
    });

    sendBudgetAndBillNotifications(reminders);
}

async function enableReminderNotifications() {
    if (!("Notification" in window)) {
        alert("Browser notifications are not supported on this device.");
        return;
    }
    const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") {
        alert("Notifications were not enabled. You can change this in your browser settings.");
        return;
    }
    localStorage.setItem(`moneytrack-notifications-${currentUser.id}`, "enabled");
    renderBillReminders();
    alert("Budget and bill reminders are enabled for this browser.");
}

function sendBudgetNotification(category, spent, limit) {
    if (!("Notification" in window) || Notification.permission !== "granted" || !currentUser) return;
    if (localStorage.getItem(`moneytrack-notifications-${currentUser.id}`) !== "enabled") return;
    const key = `budget:${category}:${getLocalISODate().slice(0, 7)}:${spent >= limit ? "100" : "80"}`;
    if (sessionStorage.getItem(key)) return;
    new Notification(`${category} budget alert`, {
        body: `${formatMoney(spent)} of ${formatMoney(limit)} used${spent >= limit ? " — budget exceeded" : " — 80% reached"}`
    });
    sessionStorage.setItem(key, "1");
}

function sendBudgetAndBillNotifications(reminders) {
    if (!("Notification" in window) || Notification.permission !== "granted" || !currentUser) {
        return;
    }
    if (localStorage.getItem(`moneytrack-notifications-${currentUser.id}`) !== "enabled") {
        return;
    }
    reminders.forEach(template => {
        const key = `bill:${template.id}:${template.pendingDate || template.nextDate}`;
        if (!sessionStorage.getItem(key)) {
            new Notification(`Bill reminder: ${template.description === "-" ? template.category : template.description}`, {
                body: `${formatMoney(template.amount)} is due ${template.pendingDate || template.nextDate}`
            });
            sessionStorage.setItem(key, "1");
        }
    });
}

async function removeRecurringTemplate(id) {

    if (!currentUser) {
        return;
    }

    if (!confirm("Remove this recurring item? This will not change past transactions.")) {
        return;
    }

    const message =
        document.getElementById("recurringMessage");

    try {
        const templates =
            getRecurringTemplates().filter(template => template.id !== id);
        await saveRecurringTemplates(templates);
        renderRecurringTemplates();
        message.textContent = "Recurring item removed.";
        message.className = "profile-message success";
    } catch (error) {
        console.error("Could not remove recurring item:", error);
        message.textContent =
            `Could not remove recurring item: ${error.message}`;
        message.className = "profile-message error";
    }
}

async function confirmRecurringOccurrence(id) {

    const button =
        [...document.querySelectorAll(".recurring-confirm-btn")]
            .find(candidate => candidate.dataset.recurringId === id);

    const message =
        document.getElementById("recurringMessage");

    const originalTemplates = getRecurringTemplates();
    const template = originalTemplates.find(item => item.id === id);

    if (!template || !currentUser) {
        message.textContent = "This recurring item is no longer available.";
        message.className = "profile-message error";
        renderRecurringTemplates();
        return;
    }

    const today = getLocalISODate();
    const occurrenceDate = template.pendingDate || template.nextDate;

    if (!template.pendingDate && occurrenceDate > today) {
        message.textContent = "This recurring item is not due yet.";
        message.className = "profile-message error";
        return;
    }

    const confirmed = confirm(
        `Add this ${template.type} transaction?\n\n` +
        `${template.description === "-" ? template.category : template.description}\n` +
        `${formatMoney(template.amount)} Â· ${formatDate(occurrenceDate)}`
    );

    if (!confirmed) {
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Adding...";
    }

    message.textContent = "";
    message.className = "profile-message";

    let templates = originalTemplates;

    if (!template.pendingDate) {
        templates = originalTemplates.map(item =>
            item.id === id
                ? {
                    ...item,
                    nextDate: advanceRecurringDate(
                        item.nextDate,
                        item.frequency,
                        item.dayOfMonth
                    ),
                    pendingDate: occurrenceDate
                }
                : item
        );

        try {
            await saveRecurringTemplates(templates);
        } catch (error) {
            console.error("Could not prepare recurring occurrence:", error);
            message.textContent =
                `Could not prepare this transaction: ${error.message}`;
            message.className = "profile-message error";
            renderRecurringTemplates();
            return;
        }
    }

    const occurrence =
        templates.find(item => item.id === id);

    try {
        const occurrenceKey = `${occurrence.id}:${occurrenceDate}`;
        const recordedOccurrences = Array.isArray(
            currentUser.user_metadata?.recordedRecurringOccurrences
        )
            ? currentUser.user_metadata.recordedRecurringOccurrences.map(String)
            : [];
        const alreadyRecorded = recordedOccurrences.includes(occurrenceKey);

        if (!alreadyRecorded) {
            const { error } =
                await supabaseClient
                    .from("transactions")
                    .insert({
                        user_id: currentUser.id,
                        type: occurrence.type,
                        amount: occurrence.amount,
                        date: occurrenceDate,
                        category: occurrence.category,
                        description: occurrence.description
                    });

            if (error) {
                throw error;
            }

            await saveAccountMetadata({
                recordedRecurringOccurrences: [...new Set([
                    ...recordedOccurrences,
                    occurrenceKey
                ])]
            });
        }

        const completedTemplates = templates.map(item => {
            if (item.id !== id) {
                return item;
            }

            const { pendingDate, ...completed } = item;
            return completed;
        });

        currentUser = {
            ...currentUser,
            user_metadata: {
                ...currentUser.user_metadata,
                recurringTransactions: completedTemplates
            }
        };

        try {
            await saveRecurringTemplates(completedTemplates);
        } catch (error) {
            console.error("Could not sync completed recurring schedule:", error);
            message.textContent =
                "Transaction added, but the recurring schedule could not sync. Please restore the connection before confirming another occurrence.";
            message.className = "profile-message error";
            renderRecurringTemplates();
            await updateDashboard();
            return;
        }

        renderRecurringTemplates();
        message.textContent = alreadyRecorded
            ? "This transaction was already recorded; the recurring schedule has been updated."
            : "Transaction added to your history.";
        message.className = "profile-message success";
        await updateDashboard();
    } catch (error) {
        console.error("Could not add recurring transaction:", error);
        message.textContent =
            `Could not add this transaction. The occurrence is saved for retry: ${error.message}`;
        message.className = "profile-message error";
        renderRecurringTemplates();
    }
}

async function saveBudgetLimits(budgets) {

    const monthValue = document.getElementById("budgetMonth")?.value;
    const month = monthValue ? `${monthValue}-01` : `${getLocalISODate().slice(0, 7)}-01`;
    let metadataSaved = budgets;
    if (databaseFeaturesLoaded) {
        await supabaseClient.from("budgets").delete()
            .eq("user_id", currentUser.id).eq("month", month);
        const rows = Object.entries(budgets).map(([category, amount]) => ({
            user_id: currentUser.id,
            category,
            month,
            amount,
            rollover_enabled: Boolean(document.getElementById("budgetRollover")?.checked)
        }));
        if (rows.length) {
            const { error } = await supabaseClient.from("budgets").insert(rows);
            if (error) throw error;
        }
        await loadDatabaseFeatures();
    }

    const { data, error } = await supabaseClient.auth.updateUser({
        data: { ...currentUser.user_metadata, budgets: metadataSaved }
    });
    if (error) throw error;
    currentUser = data.user;
}

async function saveBudgetPreference(values) {
    const { data, error } = await supabaseClient.auth.updateUser({
        data: {
            ...currentUser.user_metadata,
            ...values
        }
    });
    if (error) throw error;
    currentUser = data.user;
}

async function saveOverallBudget() {
    const input = document.getElementById("overallBudgetLimit");
    const message = document.getElementById("budgetMessage");
    const limit = Number(input.value);
    if (!Number.isFinite(limit) || limit <= 0) {
        message.textContent = "Enter an overall monthly budget greater than zero.";
        message.className = "profile-message error";
        return;
    }
    await saveBudgetPreference({ overallMonthlyBudget: limit });
    input.value = "";
    await updateBudgets();
    message.textContent = "Overall monthly budget saved.";
    message.className = "profile-message success";
}

async function saveMonthlyBudget() {

    const categoryInput =
        document.getElementById("budgetCategory");

    const limitInput =
        document.getElementById("budgetLimit");

    const saveButton =
        document.getElementById("saveBudgetButton");

    const message =
        document.getElementById("budgetMessage");

    const category = categoryInput.value;
    const limit = Number(limitInput.value);

    if (!currentUser) {
        message.textContent =
            "Your session has expired. Please log in again.";
        message.className = "profile-message error";
        return;
    }

    if (
        !getBudgetCategories().includes(category) ||
        !Number.isFinite(limit) ||
        limit <= 0
    ) {
        message.textContent =
            "Choose an expense category and enter a limit greater than zero.";
        message.className = "profile-message error";
        limitInput.focus();
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    message.textContent = "";
    message.className = "profile-message";

    try {
        const budgets = getBudgetLimits();
        budgets[category] = limit;
        await saveBudgetLimits(budgets);
        await saveBudgetPreference({ budgetRolloverEnabled: document.getElementById("budgetRollover").checked });
        limitInput.value = "";
        const refreshed = await updateBudgets();
        message.textContent = refreshed
            ? `${category} monthly budget saved.`
            : `${category} budget was saved, but spending totals could not be refreshed.`;
        message.className = refreshed
            ? "profile-message success"
            : "profile-message error";
    } catch (error) {
        console.error("Could not save monthly budget:", error);
        message.textContent =
            `Could not save this budget: ${error.message}`;
        message.className = "profile-message error";
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Budget";
    }
}

async function removeMonthlyBudget(category) {

    if (!getBudgetCategories().includes(category) || !currentUser) {
        return;
    }

    if (!confirm(`Remove the ${category} monthly budget?`)) {
        return;
    }

    const message =
        document.getElementById("budgetMessage");

    message.textContent = "Removing budget...";
    message.className = "profile-message";

    try {
        const budgets = getBudgetLimits();
        delete budgets[category];
        await saveBudgetLimits(budgets);
        const refreshed = await updateBudgets();
        message.textContent = refreshed
            ? `${category} monthly budget removed.`
            : `${category} budget was removed, but spending totals could not be refreshed.`;
        message.className = refreshed
            ? "profile-message success"
            : "profile-message error";
    } catch (error) {
        console.error("Could not remove monthly budget:", error);
        message.textContent =
            `Could not remove this budget: ${error.message}`;
        message.className = "profile-message error";
    }
}

async function updateBudgets() {

    initializeBudgetMonth();

    try {
        renderBudgetCards(
            await getTransactions({ throwOnError: true })
        );
        return true;
    } catch (error) {
        console.error("Could not refresh budget totals:", error);
        const cards =
            document.getElementById("budgetCards");
        const summary =
            document.getElementById("budgetSummary");
        const emptyMessage =
            document.getElementById("budgetEmptyMessage");
        const loadError =
            document.getElementById("budgetLoadError");

        cards.replaceChildren();
        summary.replaceChildren();
        emptyMessage.classList.add("hidden");
        loadError.textContent =
            `Could not load transaction data: ${error.message}`;
        loadError.classList.remove("hidden");
        return false;
    }
}

function renderBudgetCards(transactions) {

    const cards =
        document.getElementById("budgetCards");

    const summary =
        document.getElementById("budgetSummary");

    const loadError =
        document.getElementById("budgetLoadError");

    const emptyMessage =
        document.getElementById("budgetEmptyMessage");

    const monthInput =
        document.getElementById("budgetMonth");

    if (!cards || !summary || !emptyMessage) {
        return;
    }

    const budgets = getBudgetLimits();
    const now = new Date();
    const selectedMonth =
        monthInput?.value ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const categories = getBudgetCategories().filter(
        category => budgets[category] > 0
    );

    const rolloverEnabled = currentUser?.user_metadata?.budgetRolloverEnabled === true;
    const rolloverInput = document.getElementById("budgetRollover");
    if (rolloverInput) rolloverInput.checked = rolloverEnabled;
    const overallInput = document.getElementById("overallBudgetLimit");
    if (overallInput && !overallInput.value && Number(currentUser?.user_metadata?.overallMonthlyBudget) > 0) {
        overallInput.value = Number(currentUser.user_metadata.overallMonthlyBudget);
    }

    cards.replaceChildren();
    summary.replaceChildren();
    loadError.classList.add("hidden");
    loadError.textContent = "";
    emptyMessage.classList.toggle("hidden", categories.length > 0);

    const overallLimit = Number(currentUser?.user_metadata?.overallMonthlyBudget) || 0;
    if (overallLimit > 0) {
        const overallSpent = transactions.reduce((sum, transaction) =>
            transaction.type === "expense" && String(transaction.date || "").startsWith(selectedMonth)
                ? sum + (Number(transaction.amount) || 0)
                : sum, 0);
        const overallItem = document.createElement("div");
        overallItem.className = "budget-summary-item";
        overallItem.innerHTML = `<strong>Overall budget</strong><span>${formatMoney(overallSpent)} of ${formatMoney(overallLimit)}</span>`;
        summary.appendChild(overallItem);
        if (overallSpent >= overallLimit * 0.8) sendBudgetNotification("Overall", overallSpent, overallLimit);
    }

    if (!categories.length) {
        return;
    }

    let totalLimit = 0;
    let totalSpent = 0;

    categories.forEach(category => {

        const limit = budgets[category];
        const spent = transactions.reduce(
            (sum, transaction) => {
                if (
                    transaction.type === "expense" &&
                    transaction.category === category &&
                    typeof transaction.date === "string" &&
                    transaction.date.startsWith(selectedMonth)
                ) {
                    return sum + (Number(transaction.amount) || 0);
                }

                return sum;
            },
            0
        );

        let effectiveLimit = limit;
        if (rolloverEnabled) {
            const [year, month] = selectedMonth.split("-").map(Number);
            const prior = new Date(year, month - 2, 1);
            const priorMonth = `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, "0")}`;
            const priorSpent = transactions.reduce((sum, transaction) =>
                transaction.type === "expense" && transaction.category === category && String(transaction.date || "").startsWith(priorMonth)
                    ? sum + (Number(transaction.amount) || 0)
                    : sum, 0);
            effectiveLimit += Math.max(0, limit - priorSpent);
        }
        const remaining = effectiveLimit - spent;
        const percentage = effectiveLimit > 0
            ? (spent / limit) * 100
            : 0;
        const state = percentage > 100
            ? "over"
            : percentage >= 80
                ? "near"
                : "on-track";

        totalLimit += effectiveLimit;
        totalSpent += spent;
        if (percentage >= 80) sendBudgetNotification(category, spent, effectiveLimit);

        const card = document.createElement("article");
        card.className = `budget-card ${state}`;

        const heading = document.createElement("div");
        heading.className = "budget-card-heading";

        const title = document.createElement("h3");
        title.textContent = category;

        const limitText = document.createElement("span");
        limitText.textContent = `${formatMoney(effectiveLimit)} limit${rolloverEnabled ? " incl. rollover" : ""}`;

        heading.append(title, limitText);

        const amounts = document.createElement("div");
        amounts.className = "budget-amounts";

        const spentText = document.createElement("strong");
        spentText.textContent = formatMoney(spent);

        const limitLabel = document.createElement("span");
        limitLabel.textContent = `of ${formatMoney(effectiveLimit)} spent`;
        amounts.append(spentText, limitLabel);

        const progress = document.createElement("div");
        progress.className = "budget-progress-track";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-label", `${category} budget used`);
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");
        progress.setAttribute(
            "aria-valuenow",
            String(Math.min(100, Math.round(percentage)))
        );

        const progressFill = document.createElement("div");
        progressFill.className = "budget-progress-fill";
        progressFill.style.width = `${Math.min(100, percentage)}%`;
        progress.appendChild(progressFill);

        const status = document.createElement("p");
        status.className = "budget-status";
        status.textContent = remaining >= 0
            ? `${formatMoney(remaining)} remaining`
            : `${formatMoney(Math.abs(remaining))} over budget`;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "budget-remove-btn";
        removeButton.textContent = "Remove";
        removeButton.setAttribute(
            "aria-label",
            `Remove ${category} budget`
        );
        removeButton.addEventListener(
            "click",
            () => removeMonthlyBudget(category)
        );

        card.append(
            heading,
            amounts,
            progress,
            status,
            removeButton
        );
        cards.appendChild(card);
    });

    const monthLabel = new Date(`${selectedMonth}-01T00:00:00`)
        .toLocaleDateString(preferredDateLocale, {
            month: "long",
            year: "numeric"
        });
    const summaryText = document.createElement("p");
    summaryText.textContent =
        `${monthLabel}: ${formatMoney(totalSpent)} spent across ` +
        `${categories.length} ${categories.length === 1 ? "budget" : "budgets"} ` +
        `with a combined limit of ${formatMoney(totalLimit)}.`;
    summary.appendChild(summaryText);
}


