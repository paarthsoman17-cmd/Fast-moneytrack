// ==========================================
// ADD TRANSACTION
// ==========================================

function makeLocalId() {
    return window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSavingsGoals() {

    if (databaseFeaturesLoaded) {
        return databaseSavingsGoals.map(goal => ({
            id: String(goal.id),
            name: String(goal.name).trim(),
            target: Number(goal.target_amount),
            targetDate: goal.target_date || ""
        })).filter(goal => goal.name && goal.target > 0);
    }

    const saved = currentUser?.user_metadata?.savingsGoals;

    if (!Array.isArray(saved)) {
        return [];
    }

    return saved.filter(goal =>
        goal &&
        typeof goal.id === "string" &&
        typeof goal.name === "string" &&
        goal.name.trim().length > 0 &&
        Number.isFinite(Number(goal.target)) &&
        Number(goal.target) > 0 &&
        (!goal.targetDate || isValidISODate(goal.targetDate))
    ).map(goal => ({
        id: goal.id,
        name: goal.name.trim().slice(0, 60),
        target: Number(goal.target),
        targetDate: goal.targetDate || ""
    }));
}

function getSavingsContributions() {

    const saved = currentUser?.user_metadata?.savingsContributions;

    if (!Array.isArray(saved)) {
        return [];
    }

    const seen = new Set();

    return saved.filter(contribution => {
        if (
            !contribution ||
            (typeof contribution.transactionId !== "string" &&
                typeof contribution.transactionId !== "number") ||
            typeof contribution.goalId !== "string"
        ) {
            return false;
        }

        const transactionId = String(contribution.transactionId);
        if (seen.has(transactionId)) {
            return false;
        }
        seen.add(transactionId);
        return true;
    }).map(contribution => ({
        transactionId: String(contribution.transactionId),
        goalId: contribution.goalId
    }));
}

function refreshSavingsGoalSelect(selectedGoalId = "") {

    const select = document.getElementById("transactionSavingsGoal");
    if (!select) {
        return;
    }

    select.replaceChildren();

    const noGoal = document.createElement("option");
    noGoal.value = "";
    noGoal.textContent = "Not linked to a savings goal";
    select.appendChild(noGoal);

    getSavingsGoals().forEach(goal => {
        const option = document.createElement("option");
        option.value = goal.id;
        option.textContent = goal.name;
        select.appendChild(option);
    });

    select.value = selectedGoalId;
}

function updateSavingsGoalAvailability() {

    const type = document.getElementById("transactionType");
    const select = document.getElementById("transactionSavingsGoal");

    if (!type || !select) {
        return;
    }

    select.disabled = type.value !== "expense";

    if (select.disabled) {
        select.value = "";
    }
}

function getGoalContributionTotal(goalId, transactions) {

    const linkedIds = new Set(
        getSavingsContributions()
            .filter(item => item.goalId === goalId)
            .map(item => item.transactionId)
    );

    return transactions.reduce((total, transaction) => {
        if (
            transaction.type === "expense" &&
            linkedIds.has(String(transaction.id))
        ) {
            return total + (Number(transaction.amount) || 0);
        }
        return total;
    }, 0);
}

function renderSavingsGoals(transactions = transactionCache || []) {

    const list = document.getElementById("savingsGoalList");
    const empty = document.getElementById("savingsGoalEmpty");

    if (!list || !empty) {
        return;
    }

    const goals = getSavingsGoals();
    list.replaceChildren();
    empty.classList.toggle("hidden", goals.length > 0);

    goals.forEach(goal => {
        const saved = getGoalContributionTotal(goal.id, transactions);
        const percentage = Math.min(100, saved / goal.target * 100);
        const remaining = Math.max(0, goal.target - saved);
        const card = document.createElement("article");
        card.className = "feature-card savings-goal-card";

        const heading = document.createElement("div");
        heading.className = "feature-card-heading";

        const title = document.createElement("h3");
        title.textContent = goal.name;

        const targetDate = document.createElement("span");
        targetDate.textContent = goal.targetDate
            ? `Target date Â· ${formatDate(goal.targetDate)}`
            : "No target date";
        heading.append(title, targetDate);

        const amounts = document.createElement("div");
        amounts.className = "feature-card-amounts";
        const current = document.createElement("strong");
        current.textContent = formatMoney(saved);
        const target = document.createElement("span");
        target.textContent = `of ${formatMoney(goal.target)}`;
        amounts.append(current, target);

        const progress = document.createElement("div");
        progress.className = "feature-progress-track";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-label", `${goal.name} progress`);
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", String(goal.target));
        progress.setAttribute("aria-valuenow", String(Math.min(saved, goal.target)));
        const fill = document.createElement("div");
        fill.className = "feature-progress-fill";
        fill.style.width = `${percentage}%`;
        progress.appendChild(fill);

        const status = document.createElement("p");
        status.className = "feature-card-status";
        status.textContent = remaining > 0
            ? `${formatMoney(remaining)} left to reach your goal`
            : "Goal reached!";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "budget-remove-btn";
        removeButton.textContent = "Remove goal";
        removeButton.addEventListener("click", () => removeSavingsGoal(goal.id));

        card.append(heading, amounts, progress, status, removeButton);
        list.appendChild(card);
    });
}

async function saveSavingsGoal() {

    const nameInput = document.getElementById("savingsGoalName");
    const targetInput = document.getElementById("savingsGoalTarget");
    const dateInput = document.getElementById("savingsGoalDate");
    const button = document.getElementById("saveSavingsGoalButton");
    const message = document.getElementById("savingsGoalMessage");
    const name = nameInput.value.trim();
    const target = Number(targetInput.value);
    const targetDate = dateInput.value;

    if (
        !currentUser ||
        !name ||
        name.length > 60 ||
        !Number.isFinite(target) ||
        target <= 0 ||
        (targetDate && !isValidISODate(targetDate))
    ) {
        message.textContent = currentUser
            ? "Enter a goal name, a target above zero, and a valid target date."
            : "Your session has expired. Please log in again.";
        message.className = "profile-message error";
        return;
    }

    button.disabled = true;
    button.textContent = "Saving...";
    message.textContent = "";
    message.className = "profile-message";

    try {
        const goals = getSavingsGoals();
        if (goals.some(goal => goal.name.toLowerCase() === name.toLowerCase())) {
            throw new Error("A savings goal with that name already exists.");
        }

        goals.push({
            id: makeLocalId(),
            name,
            target,
            targetDate
        });

        await saveAccountMetadata({ savingsGoals: goals });
        if (databaseFeaturesLoaded) {
            const { error } = await supabaseClient.from("savings_goals").insert({
                user_id: currentUser.id,
                name,
                target_amount: target,
                target_date: targetDate || null
            });
            if (error) throw error;
            await loadDatabaseFeatures();
        }
        document.getElementById("savingsGoalForm").reset();
        refreshSavingsGoalSelect();
        renderSavingsGoals();
        message.textContent = "Savings goal created.";
        message.className = "profile-message success";
    } catch (error) {
        console.error("Could not create savings goal:", error);
        message.textContent = `Could not create savings goal: ${error.message}`;
        message.className = "profile-message error";
    } finally {
        button.disabled = false;
        button.textContent = "Create goal";
    }
}

async function removeSavingsGoal(goalId) {

    const goal = getSavingsGoals().find(item => item.id === goalId);
    if (!goal || !currentUser) {
        return;
    }

    if (!confirm(`Remove the "${goal.name}" savings goal? Its linked transactions will remain in your history.`)) {
        return;
    }

    const message = document.getElementById("savingsGoalMessage");

    try {
        const goals = getSavingsGoals().filter(item => item.id !== goalId);
        const contributions = getSavingsContributions()
            .filter(item => item.goalId !== goalId);
        await saveAccountMetadata({
            savingsGoals: goals,
            savingsContributions: contributions
        });
        if (databaseFeaturesLoaded) {
            const { error } = await supabaseClient.from("savings_goals")
                .delete().eq("user_id", currentUser.id).eq("id", goalId);
            if (error) throw error;
            await loadDatabaseFeatures();
        }
        refreshSavingsGoalSelect();
        renderSavingsGoals();
        message.textContent = "Savings goal removed. Transactions were not changed.";
        message.className = "profile-message success";
    } catch (error) {
        console.error("Could not remove savings goal:", error);
        message.textContent = `Could not remove savings goal: ${error.message}`;
        message.className = "profile-message error";
    }
}

async function updateTransactionSavingsGoal(transactionId, goalId, type) {

    const existing = getSavingsContributions();
    const contributions = existing
        .filter(item => item.transactionId !== String(transactionId));

    if (goalId) {
        if (type !== "expense") {
            throw new Error("Only expense transactions can contribute to savings goals.");
        }
        if (!getSavingsGoals().some(goal => goal.id === goalId)) {
            throw new Error("That savings goal is no longer available.");
        }
        contributions.push({
            transactionId: String(transactionId),
            goalId
        });
    } else if (contributions.length === existing.length) {
        return;
    }

    await saveAccountMetadata({ savingsContributions: contributions });
}

function renderCategoryList() {

    const list = document.getElementById("categoryList");
    if (!list) {
        return;
    }

    list.replaceChildren();
    getTransactionCategories().forEach(category => {
        const row = document.createElement("div");
        row.className = "category-row";

        const name = document.createElement("strong");
        name.textContent = category;
        row.appendChild(name);

        if (DEFAULT_CATEGORIES.includes(category)) {
            const badge = document.createElement("span");
            badge.className = "category-default-badge";
            badge.textContent = "Built in";
            row.appendChild(badge);
        } else {
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "budget-remove-btn";
            removeButton.textContent = "Remove";
            removeButton.addEventListener(
                "click",
                () => removeCustomCategory(category)
            );
            row.appendChild(removeButton);
        }

        list.appendChild(row);
    });
}

async function addCustomCategory() {

    const input = document.getElementById("newCategoryName");
    const button = document.getElementById("addCategoryButton");
    const message = document.getElementById("categoryMessage");
    const name = input.value.trim();

    if (
        !currentUser ||
        !name ||
        name.length > 40 ||
        name.toLowerCase() === "__proto__"
    ) {
        message.textContent = currentUser
            ? "Enter a category name up to 40 characters long that is not reserved."
            : "Your session has expired. Please log in again.";
        message.className = "profile-message error";
        return;
    }

    if (getTransactionCategories().some(category =>
        category.toLowerCase() === name.toLowerCase()
    )) {
        message.textContent = "That category already exists.";
        message.className = "profile-message error";
        return;
    }

    button.disabled = true;
    button.textContent = "Adding...";

    try {
        const categoryType = document.getElementById("newCategoryType").value === "income"
            ? "income"
            : "expense";
        await saveAccountMetadata({
            customCategories: [
                ...getCustomCategoryDefinitions(),
                { name, type: categoryType }
            ]
        });
        if (databaseFeaturesLoaded) {
            const { error } = await supabaseClient.from("custom_categories").insert({
                user_id: currentUser.id,
                name,
                type: categoryType
            });
            if (error) throw error;
            await loadDatabaseFeatures();
        }
        input.value = "";
        document.getElementById("newCategoryType").value = "expense";
        refreshCategorySelects();
        renderCategoryList();
        message.textContent = `${name} category added.`;
        message.className = "profile-message success";
    } catch (error) {
        console.error("Could not add category:", error);
        message.textContent = `Could not add category: ${error.message}`;
        message.className = "profile-message error";
    } finally {
        button.disabled = false;
        button.textContent = "Add category";
    }
}

async function removeCustomCategory(category) {

    if (!currentUser || !getCustomCategories().includes(category)) {
        return;
    }

    const isUsedByBudget =
        Object.prototype.hasOwnProperty.call(getBudgetLimits(), category);
    const isUsedByRecurring =
        getRecurringTemplates().some(template => template.category === category);

    if (isUsedByBudget || isUsedByRecurring) {
        const usage = [
            isUsedByBudget ? "a monthly budget" : "",
            isUsedByRecurring ? "a recurring transaction" : ""
        ].filter(Boolean).join(" and ");
        const message = document.getElementById("categoryMessage");
        message.textContent =
            `Remove ${usage} using this category first. Historical transactions will remain unchanged.`;
        message.className = "profile-message error";
        return;
    }

    if (!confirm(`Remove the "${category}" category? Historical transactions will keep this category name.`)) {
        return;
    }

    const message = document.getElementById("categoryMessage");

    try {
        await saveAccountMetadata({
            customCategories: getCustomCategoryDefinitions()
                .filter(item => item.name !== category)
        });
        if (databaseFeaturesLoaded) {
            const { error } = await supabaseClient.from("custom_categories")
                .delete().eq("user_id", currentUser.id).eq("name", category);
            if (error) throw error;
            await loadDatabaseFeatures();
        }
        refreshCategorySelects();
        renderCategoryList();
        message.textContent = `${category} category removed. Historical transactions were not changed.`;
        message.className = "profile-message success";
    } catch (error) {
        console.error("Could not remove category:", error);
        message.textContent = `Could not remove category: ${error.message}`;
        message.className = "profile-message error";
    }
}

function setTransactionMessage(message, type = "success") {
    const element = document.getElementById("transactionMessage");
    if (!element) {
        return;
    }
    element.textContent = message;
    element.className = `profile-message ${type === "error" ? "error" : "success"}`;
}

async function addTransaction() {

    // If currently editing, update instead
    if (editingTransactionId !== null) {

        await updateTransaction(
            editingTransactionId
        );

        return;
    }


    const user =
        await getCurrentUser();


    if (!user) {

        setTransactionMessage("Please log in first.", "error");

        return;
    }


    const type =
        document.getElementById(
            "transactionType"
        ).value;

    const amount =
        Number(
            document.getElementById(
                "amount"
            ).value
        );

    const date =
        document.getElementById(
            "transactionDate"
        ).value;

    const category =
        document.getElementById(
            "category"
        ).value;

    const description =
        document.getElementById(
            "description"
        ).value.trim();

    const savingsGoalId =
        document.getElementById("transactionSavingsGoal").value;


    if (!amount || amount <= 0) {

        setTransactionMessage("Please enter a valid amount.", "error");

        return;
    }


    if (!date) {

        setTransactionMessage("Please select a date.", "error");

        return;
    }

    if (savingsGoalId && type !== "expense") {
        setTransactionMessage("Only expense transactions can contribute to a savings goal.", "error");
        return;
    }

    const {
        data: inserted,
        error
    } = await supabaseClient

        .from("transactions")

        .insert({

            user_id: user.id,

            type: type,

            amount: amount,

            date: date,

            category: category,

            description:
                description || "-"

        })
        .select("id")
        .single();


    if (error) {

        console.error(error);

        setTransactionMessage("Could not save transaction: " + error.message, "error");

        return;
    }

    if (savingsGoalId) {
        try {
            await updateTransactionSavingsGoal(
                inserted.id,
                savingsGoalId,
                type
            );
        } catch (error) {
            console.error("Could not link transaction to savings goal:", error);
            setTransactionMessage(`Transaction was saved, but its savings-goal contribution could not be recorded: ${error.message}`, "error");
        }
    }

    resetTransactionForm();
    setTransactionMessage("Transaction added successfully.");

    await updateDashboard();

    // Keep user on History after adding
    showView("history");
}


// ==========================================
// EDIT TRANSACTION
// ==========================================

async function editTransaction(id) {

    const transactions =
        await getTransactions();


    const transaction =
        transactions.find(
            item =>
                String(item.id) === String(id)
        );


    if (!transaction) {

        return;

    }


    document.getElementById(
        "transactionType"
    ).value =
        transaction.type;
    updateSavingsGoalAvailability();


    document.getElementById(
        "amount"
    ).value =
        transaction.amount;


    document.getElementById(
        "transactionDate"
    ).value =
        transaction.date;


    setSelectOptions(
        document.getElementById("category"),
        getTransactionCategories(),
        transaction.category
    );


    document.getElementById(
        "description"
    ).value =
        transaction.description === "-"
            ? ""
            : transaction.description;

    const linkedGoal = getSavingsContributions()
        .find(item => item.transactionId === String(id));
    refreshSavingsGoalSelect(linkedGoal?.goalId || "");

    editingTransactionId = id;


    const button =
        document.querySelector(
            ".transaction-form .primary-btn"
        );


    if (button) {

        button.textContent =
            "Update Transaction";

    }


    const form =
        document.querySelector(
            ".transaction-form"
        );


    if (form) {

        form.scrollIntoView({

            behavior: "smooth",

            block: "center"

        });

    }

}


// ==========================================
// UPDATE TRANSACTION
// ==========================================

async function updateTransaction(id) {

    const user =
        await getCurrentUser();


    if (!user) {

        setTransactionMessage("Please log in first.", "error");

        return;
    }


    const type =
        document.getElementById(
            "transactionType"
        ).value;

    const amount =
        Number(
            document.getElementById(
                "amount"
            ).value
        );

    const date =
        document.getElementById(
            "transactionDate"
        ).value;

    const category =
        document.getElementById(
            "category"
        ).value;

    const description =
        document.getElementById(
            "description"
        ).value.trim();

    const savingsGoalId =
        document.getElementById("transactionSavingsGoal").value;


    if (!amount || amount <= 0) {

        setTransactionMessage("Please enter a valid amount.", "error");

        return;
    }


    if (!date) {

        setTransactionMessage("Please select a date.", "error");

        return;
    }

    if (savingsGoalId && type !== "expense") {
        setTransactionMessage("Only expense transactions can contribute to a savings goal.", "error");
        return;
    }

    const {
        error
    } = await supabaseClient

        .from("transactions")

        .update({

            type: type,

            amount: amount,

            date: date,

            category: category,

            description:
                description || "-"

        })

        .eq("id", id)

        .eq("user_id", user.id);


    if (error) {

        console.error(error);

        setTransactionMessage("Could not update transaction: " + error.message, "error");

        return;
    }

    try {
        await updateTransactionSavingsGoal(id, savingsGoalId, type);
    } catch (error) {
        console.error("Could not update savings goal contribution:", error);
        setTransactionMessage(`Transaction was updated, but its savings-goal link could not be saved: ${error.message}`, "error");
    }

    resetTransactionForm();
    setTransactionMessage("Transaction updated successfully.");

    await updateDashboard();

    showView("history");
}


// ==========================================
// RESET TRANSACTION FORM
// ==========================================

function resetTransactionForm() {

    editingTransactionId = null;


    const amount =
        document.getElementById("amount");

    const description =
        document.getElementById(
            "description"
        );


    if (amount)
        amount.value = "";

    if (description)
        description.value = "";

    refreshSavingsGoalSelect();
    updateSavingsGoalAvailability();

    const button =
        document.querySelector(
            ".transaction-form .primary-btn"
        );


    if (button) {

        button.textContent =
            "Add Transaction";

    }

}


// ==========================================
// DELETE TRANSACTION
// ==========================================

async function deleteTransaction(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this transaction?"
        );


    if (!confirmed) {

        return;

    }


    const user =
        await getCurrentUser();


    if (!user) {

        setTransactionMessage("Please log in first.", "error");

        return;
    }


    const {
        error
    } = await supabaseClient

        .from("transactions")

        .delete()

        .eq("id", id)

        .eq("user_id", user.id);


    if (error) {

        console.error(error);

        setTransactionMessage("Could not delete transaction: " + error.message, "error");

        return;
    }

    try {
        await updateTransactionSavingsGoal(id, "", "expense");
    } catch (error) {
        console.error("Could not remove savings transaction link:", error);
        setTransactionMessage(`Transaction was deleted, but its savings-goal link could not be cleared: ${error.message}`, "error");
    }

    setTransactionMessage("Transaction deleted successfully.");
    await updateDashboard();

}


