// ==========================================
// DASHBOARD
// ==========================================

async function updateDashboard() {

    const transactions =
        await getTransactions({ force: true });


    let income = 0;

    let expenses = 0;


    transactions.forEach(
        transaction => {

            const amount =
                Number(
                    transaction.amount
                ) || 0;


            if (
                transaction.type ===
                "income"
            ) {

                income += amount;

            }


            if (
                transaction.type ===
                "expense"
            ) {

                expenses += amount;

            }

        }
    );


    const balance =
        income - expenses;


    const totalIncome =
        document.getElementById(
            "totalIncome"
        );

    const totalExpense =
        document.getElementById(
            "totalExpense"
        );

    const balanceElement =
        document.getElementById(
            "balance"
        );


    if (totalIncome) {

        totalIncome.textContent =
            formatMoney(income);

    }


    if (totalExpense) {

        totalExpense.textContent =
            formatMoney(expenses);

    }


    if (balanceElement) {

        balanceElement.textContent =
            formatMoney(balance);

    }

    renderDashboardInsights(transactions);
    renderSavingsGoals(transactions);
    renderBillReminders();

    renderTransactions(
        transactions
    );

    renderBudgetCards(transactions);


    initializeReportMonth();

    await updateReports();
}

function renderDashboardInsights(transactions) {

    const now = new Date();
    const currentMonth =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousDate =
        new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth =
        `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    const today = getLocalISODate(now);
    const previousMonthLastDay =
        new Date(previousDate.getFullYear(), previousDate.getMonth() + 1, 0)
            .getDate();
    const previousPeriodEnd = getLocalISODate(
        new Date(
            previousDate.getFullYear(),
            previousDate.getMonth(),
            Math.min(now.getDate(), previousMonthLastDay)
        )
    );

    let currentSpending = 0;
    let previousSpending = 0;
    const categoryTotals = new Map();

    transactions.forEach(transaction => {
        if (transaction.type !== "expense") {
            return;
        }

        const amount = Number(transaction.amount) || 0;
        const date = String(transaction.date || "").slice(0, 10);
        const month = date.slice(0, 7);

        if (month === currentMonth && date <= today) {
            currentSpending += amount;
            const category = transaction.category || "Other";
            categoryTotals.set(
                category,
                (categoryTotals.get(category) || 0) + amount
            );
        } else if (
            month === previousMonth &&
            date <= previousPeriodEnd
        ) {
            previousSpending += amount;
        }
    });

    const currentAmount =
        document.getElementById("monthToDateSpending");
    const currentCaption =
        document.getElementById("monthSpendingCaption");
    const changeAmount =
        document.getElementById("monthlySpendingChange");
    const comparison =
        document.getElementById("monthlySpendingComparison");
    const topCategory =
        document.getElementById("topSpendingCategory");
    const topAmount =
        document.getElementById("topSpendingAmount");

    currentAmount.textContent = formatMoney(currentSpending);
    currentCaption.textContent =
        `Month to date Â· ${now.toLocaleDateString(preferredDateLocale, { month: "long" })}`;

    changeAmount.className = "insight-change";
    if (previousSpending === 0) {
        changeAmount.textContent =
            currentSpending === 0 ? "â€”" : "New spending";
        comparison.textContent = currentSpending === 0
            ? "No expenses in either month"
            : `No spending through ${formatDate(previousPeriodEnd)} last month`;
    } else {
        const change =
            ((currentSpending - previousSpending) / previousSpending) * 100;
        const rounded = Math.round(Math.abs(change));

        if (change > 0) {
            changeAmount.textContent = `${rounded}% more`;
            changeAmount.classList.add("spending-increase");
        } else if (change < 0) {
            changeAmount.textContent = `${rounded}% less`;
            changeAmount.classList.add("spending-decrease");
        } else {
            changeAmount.textContent = "No change";
        }

        comparison.textContent =
            `${formatMoney(currentSpending)} vs ${formatMoney(previousSpending)} through ${formatDate(previousPeriodEnd)}`;
    }

    const topEntry =
        [...categoryTotals.entries()]
            .sort((a, b) => b[1] - a[1])[0];

    topCategory.textContent = topEntry?.[0] || "â€”";
    topAmount.textContent = topEntry
        ? `${formatMoney(topEntry[1])} spent month to date`
        : "No expenses recorded this month";
}


// ==========================================
// TRANSACTION HISTORY
// ==========================================

function getFilteredTransactions(transactions) {

    const filterElement =
        document.getElementById(
            "filterType"
        );

    const searchElement =
        document.getElementById(
            "transactionSearch"
        );

    const dateFromElement =
        document.getElementById(
            "transactionDateFrom"
        );

    const dateToElement =
        document.getElementById(
            "transactionDateTo"
        );

    const filter =
        filterElement
            ? filterElement.value
            : "all";

    const search =
        searchElement
            ? searchElement.value.trim().toLocaleLowerCase()
            : "";

    const dateFrom =
        dateFromElement?.value || "";

    const dateTo =
        dateToElement?.value || "";

    let filtered =
        [...transactions];


    if (filter !== "all") {

        filtered =
            filtered.filter(
                transaction =>
                    transaction.type ===
                    filter
            );

    }

    if (search) {
        filtered = filtered.filter(transaction => {
            const searchableValues = [
                transaction.category,
                transaction.description,
                transaction.type,
                transaction.date,
                formatDate(transaction.date),
                transaction.amount
            ];

            return searchableValues.some(value =>
                String(value ?? "")
                    .toLocaleLowerCase()
                    .includes(search)
            );
        });
    }

    if (dateFrom) {
        filtered = filtered.filter(
            transaction =>
                typeof transaction.date === "string" &&
                transaction.date >= dateFrom
        );
    }

    if (dateTo) {
        filtered = filtered.filter(
            transaction =>
                typeof transaction.date === "string" &&
                transaction.date <= dateTo
        );
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
        filtered = [];
    }


    filtered.sort(
        (a, b) =>
            new Date(b.date) -
            new Date(a.date)
    );

    return filtered;
}

function renderTransactions(
    transactions
) {

    const list =
        document.getElementById(
            "transactionList"
        );

    const emptyMessage =
        document.getElementById(
            "emptyMessage"
        );

    const exportButton =
        document.getElementById(
            "exportTransactionsButton"
        );

    const exportMessage =
        document.getElementById(
            "exportMessage"
        );

    if (!list) {
        return;
    }

    const dateFrom =
        document.getElementById("transactionDateFrom")?.value || "";
    const dateTo =
        document.getElementById("transactionDateTo")?.value || "";

    const filtered = getFilteredTransactions(transactions);
    list.innerHTML = "";

    if (exportMessage) {
        exportMessage.textContent = "";
    }

    if (exportButton) {
        exportButton.disabled = filtered.length === 0;
    }

    if (filtered.length === 0) {

        if (emptyMessage) {

            emptyMessage.style.display =
                "block";
            emptyMessage.textContent =
                dateFrom && dateTo && dateFrom > dateTo
                    ? "The start date must be on or before the end date."
                    : transactions.length === 0
                        ? "No transactions yet."
                        : "No transactions match these filters.";

        }

        return;

    }


    if (emptyMessage) {

        emptyMessage.style.display =
            "none";

    }


    filtered.forEach(
        transaction => {

            const row =
                document.createElement(
                    "tr"
                );


            const typeText =
                transaction.type ===
                    "income"
                    ? "Income"
                    : "Expense";


            const amount =
                Number(
                    transaction.amount
                ) || 0;


            const amountText =
                transaction.type ===
                    "income"

                    ? `+${formatMoney(
                        amount
                    )}`

                    : `-${formatMoney(
                        amount
                    )}`;


            row.innerHTML = `

                <td>
                    ${formatDate(
                transaction.date
            )}
                </td>

                <td class="${transaction.type}-text">
                    ${typeText}
                </td>

                <td>
                    ${escapeHTML(
                transaction.category ||
                "Other"
            )}
                </td>

                <td>
                    ${escapeHTML(
                transaction.description ||
                "-"
            )}
                </td>

                <td class="${transaction.type}-text">
                    ${amountText}
                </td>

                <td class="action-buttons">

                    <button
                        class="edit-btn"
                        type="button"
                        onclick="editTransaction('${transaction.id}')">
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        type="button"
                        onclick="deleteTransaction('${transaction.id}')">
                        Delete
                    </button>

                </td>

            `;


            list.appendChild(row);

        }
    );

}

function escapeCsvCell(value) {

    let text = String(value ?? "");

    if (
        typeof value !== "number" &&
        /^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(text)
    ) {
        text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

function exportTransactionsCsv() {

    const transactions = transactionCache;

    if (!transactions) {
        const message = document.getElementById("exportMessage");
        message.textContent =
            "Transactions are still loading. Please try again in a moment.";
        return;
    }

    const filtered = getFilteredTransactions(transactions);
    const message = document.getElementById("exportMessage");

    if (!filtered.length) {
        message.textContent =
            "There are no matching transactions to export.";
        return;
    }

    const rows = [
        ["Date", "Type", "Category", "Description", "Amount"],
        ...filtered.map(transaction => [
            transaction.date,
            transaction.type === "income" ? "Income" : "Expense",
            transaction.category || "Other",
            transaction.description || "-",
            Number.isFinite(Number(transaction.amount))
                ? transaction.type === "income"
                    ? Number(transaction.amount)
                    : -Number(transaction.amount)
                : ""
        ])
    ];

    const csv = `\uFEFF${rows.map(
        row => row.map(escapeCsvCell).join(",")
    ).join("\r\n")}`;

    let objectUrl;

    try {
        const blob = new Blob(
            [csv],
            { type: "text/csv;charset=utf-8" }
        );
        objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        const timestamp = getLocalISODate();
        link.href = objectUrl;
        link.download = `moneytrack-transactions-${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        message.textContent =
            `${filtered.length} transaction${filtered.length === 1 ? "" : "s"} exported to CSV.`;
    } catch (error) {
        console.error("Could not export transactions:", error);
        message.textContent =
            "Could not create the CSV file. Please try again.";
    } finally {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
    }
}

async function importTransactionsCsv(file) {
    const message = document.getElementById("exportMessage");
    if (!file || !currentUser) return;
    try {
        const text = await file.text();
        const rows = parseCsvRows(text).filter(row => row.length >= 5);
        const start = /^date$/i.test((rows[0]?.[0] || "").trim()) ? 1 : 0;
        const imported = [];
        for (const row of rows.slice(start)) {
            const [dateText, typeText, category, description, amountText] = row;
            const rawAmount = Number(String(amountText).replace(/,/g, ""));
            const date = normalizeImportedDate(dateText);
            if (!date || !Number.isFinite(rawAmount) || rawAmount === 0) continue;
            const type = /income/i.test(typeText || "") || rawAmount > 0 && /credit/i.test(typeText || "")
                ? "income" : "expense";
            imported.push({
                user_id: currentUser.id,
                date,
                type,
                category: category.trim() || "Other",
                description: description.trim() || "-",
                amount: Math.abs(rawAmount)
            });
        }
        if (!imported.length) throw new Error("No valid transaction rows found. Expected Date, Type, Category, Description, Amount columns.");
        const { error } = await supabaseClient.from("transactions").insert(imported);
        if (error) throw error;
        transactionCache = null;
        await updateDashboard();
        message.textContent = `${imported.length} transaction${imported.length === 1 ? "" : "s"} imported.`;
    } catch (error) {
        console.error("Could not import CSV:", error);
        message.textContent = `Could not import CSV: ${error.message}`;
    } finally {
        const input = document.getElementById("importTransactionsCsv");
        if (input) input.value = "";
    }
}

function parseCsvRows(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    const source = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (char === '"') {
            if (quoted && source[i + 1] === '"') { field += '"'; i++; }
            else quoted = !quoted;
        } else if (char === ',' && !quoted) {
            row.push(field.trim()); field = "";
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && source[i + 1] === '\n') i++;
            row.push(field.trim()); rows.push(row); row = []; field = "";
        } else field += char;
    }
    if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
    return rows;
}

function normalizeImportedDate(value) {
    const text = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isValidISODate(text) ? text : "";
    const parts = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (!parts) return "";
    const first = Number(parts[1]), second = Number(parts[2]), year = Number(parts[3]);
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    const date = new Date(year, month - 1, day);
    return Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        ? getLocalISODate(date) : "";
}


// ==========================================
// FILTER TRANSACTIONS
// ==========================================

function filterTransactions() {

    if (transactionCache !== null) {
        renderTransactions(transactionCache);
        return;
    }

    getTransactions().then(transactions => {
        transactionCache = transactions;
        renderTransactions(transactions);
    });
}

function clearTransactionFilters() {

    document.getElementById("transactionSearch").value = "";
    document.getElementById("filterType").value = "all";
    document.getElementById("transactionDateFrom").value = "";
    document.getElementById("transactionDateTo").value = "";
    filterTransactions();

}


