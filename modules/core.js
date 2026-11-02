// ==========================================
// MONEYTRACK - SUPABASE CONFIGURATION
// ==========================================

// Supabase â†’ Settings â†’ API Keys
// Use the PUBLISHABLE key.
// NEVER use the secret/service_role key here.

const SUPABASE_URL = "https://ciivqmmydlgbcqyrbxkm.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_Cq9XkGGWvEwLJQz-a7stfg__yjNQc9I";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==========================================
// GLOBAL VARIABLES
// ==========================================

let incomeExpenseChart = null;
let categoryChart = null;
let spendingTrendsChart = null;

let editingTransactionId = null;
let transactionCache = null;
let passwordRecoveryCallback = false;

let currentUser = null;
let appInitializationPromise = null;
let appInitializationUserId = null;
let initializedAppUserId = null;
let preferredCurrency = "INR";
let preferredDateLocale = "en-IN";
let preferredTheme = "light";
let databaseBudgets = [];
let databaseRecurringTemplates = [];
let databaseSavingsGoals = [];
let databaseCustomCategories = [];
let databaseFeaturesLoaded = false;

const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"];
const SUPPORTED_DATE_LOCALES = ["en-IN", "en-US", "en-CA"];
const SUPPORTED_THEMES = ["light", "dark"];
const DEFAULT_CATEGORIES = [
    "Food",
    "Travel",
    "Shopping",
    "Bills",
    "Education",
    "Entertainment",
    "Salary",
    "Pocket Money",
    "Other"
];
const BUDGET_CATEGORIES = [
    "Food",
    "Travel",
    "Shopping",
    "Bills",
    "Education",
    "Entertainment",
    "Other"
];
const RECURRING_FREQUENCIES = ["weekly", "monthly"];
const SUPPORTED_AVATARS = [
    "initials",
    "ðŸ˜Š",
    "ðŸŒŸ",
    "ðŸŽ¯",
    "ðŸ’¼",
    "ðŸŒ±"
];
const CURRENCY_LOCALES = {
    INR: "en-IN",
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB"
};

function getCustomCategoryDefinitions() {

    if (databaseFeaturesLoaded) {
        return databaseCustomCategories.map(category => ({
            name: String(category.name).trim().slice(0, 40),
            type: category.type === "income" ? "income" : "expense"
        })).filter(category => category.name);
    }

    const saved = currentUser?.user_metadata?.customCategories;

    if (!Array.isArray(saved)) {
        return [];
    }

    const seen = new Set(DEFAULT_CATEGORIES.map(category => category.toLowerCase()));

    return saved
        .map(category => typeof category === "string"
            ? { name: category, type: "expense" }
            : category && typeof category.name === "string"
                ? { name: category.name, type: category.type === "income" ? "income" : "expense" }
                : null)
        .filter(category => category?.name)
        .map(category => ({
            name: category.name.trim().slice(0, 40),
            type: category.type
        }))
        .filter(category => {
            const normalized = category.name.toLowerCase();
            if (!category.name || normalized === "__proto__" || seen.has(normalized)) {
                return false;
            }
            seen.add(normalized);
            return true;
        });
}

function getCustomCategories() {
    return getCustomCategoryDefinitions().map(category => category.name);
}

function getTransactionCategories() {
    return [...DEFAULT_CATEGORIES, ...getCustomCategories()];
}

function getBudgetCategories() {
    return [
        ...BUDGET_CATEGORIES,
        ...getCustomCategoryDefinitions()
            .filter(category => category.type === "expense")
            .map(category => category.name)
    ];
}

function setSelectOptions(select, categories, selectedValue) {

    if (!select) {
        return;
    }

    const preserveUnavailable = selectedValue !== undefined;
    const selected = preserveUnavailable ? selectedValue : select.value;
    const options = [...categories];

    if (preserveUnavailable && selected && !options.includes(selected)) {
        options.push(selected);
    }

    select.replaceChildren();
    options.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });

    if (selected && options.includes(selected)) {
        select.value = selected;
    }
}

function refreshCategorySelects() {

    setSelectOptions(
        document.getElementById("category"),
        getTransactionCategories()
    );
    setSelectOptions(
        document.getElementById("budgetCategory"),
        getBudgetCategories()
    );
    setSelectOptions(
        document.getElementById("recurringCategory"),
        getTransactionCategories()
    );
}

async function saveAccountMetadata(values) {

    if (!currentUser) {
        throw new Error("Your session has expired. Please log in again.");
    }

    const { data, error } =
        await supabaseClient.auth.updateUser({
            data: {
                ...currentUser.user_metadata,
                ...values
            }
        });

    if (error) {
        throw error;
    }

    currentUser = data.user;
}


