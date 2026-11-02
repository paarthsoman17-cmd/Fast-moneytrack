// ==========================================
// REPORT MONTH
// ==========================================

function initializeReportMonth() {

    const input =
        document.getElementById(
            "reportMonth"
        );


    if (!input) {

        return;

    }


    if (!input.value) {

        const today =
            new Date();


        input.value =
            `${today.getFullYear()}-${String(
                today.getMonth() + 1
            ).padStart(2, "0")}`;

    }

}


// ==========================================
// CHANGE REPORT MONTH
// ==========================================

function changeReportMonth(
    direction
) {

    const input =
        document.getElementById(
            "reportMonth"
        );


    if (!input) {

        return;

    }


    initializeReportMonth();


    const [year, month] =
        input.value
            .split("-")
            .map(Number);


    const date =
        new Date(
            year,
            month - 1 + direction,
            1
        );


    input.value =
        `${date.getFullYear()}-${String(
            date.getMonth() + 1
        ).padStart(2, "0")}`;


    updateReports();

}


// ==========================================
// UPDATE REPORTS
// ==========================================

async function updateReports() {

    const transactions =
        await getTransactions();


    const input =
        document.getElementById(
            "reportMonth"
        );


    if (!input) {

        return;

    }


    initializeReportMonth();


    const month =
        input.value;


    const monthlyTransactions =
        transactions.filter(
            transaction =>
                String(
                    transaction.date
                ).substring(0, 7) ===
                month
        );


    let income = 0;

    let expenses = 0;


    monthlyTransactions.forEach(
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


    // --------------------------------------
    // REPORT SUMMARY
    // --------------------------------------

    const reportIncome =
        document.getElementById(
            "reportIncome"
        );

    const reportExpense =
        document.getElementById(
            "reportExpense"
        );

    const reportBalance =
        document.getElementById(
            "reportBalance"
        );


    if (reportIncome) {

        reportIncome.textContent =
            formatMoney(income);

    }


    if (reportExpense) {

        reportExpense.textContent =
            formatMoney(expenses);

    }


    if (reportBalance) {

        reportBalance.textContent =
            formatMoney(balance);

    }


    // --------------------------------------
    // CHARTS
    // --------------------------------------

    drawIncomeExpenseChart(
        income,
        expenses
    );


    drawCategoryChart(
        monthlyTransactions
    );

    drawSpendingTrends(transactions);


}


function getChartThemeColors() {
    const dark = preferredTheme === "dark";
    return {
        text: dark ? "#d8e5e1" : "#52666a",
        grid: dark ? "rgba(216, 229, 225, 0.12)" : "rgba(16, 44, 58, 0.08)",
        doughnutBorder: dark ? "#172126" : "#ffffff"
    };
}

function refreshChartTheme() {
    const colors = getChartThemeColors();

    if (incomeExpenseChart) {
        incomeExpenseChart.options.scales.x.ticks.color = colors.text;
        incomeExpenseChart.options.scales.y.ticks.color = colors.text;
        incomeExpenseChart.options.scales.y.grid.color = colors.grid;
        incomeExpenseChart.update();
    }

    if (categoryChart) {
        categoryChart.data.datasets[0].borderColor = colors.doughnutBorder;
        categoryChart.options.plugins.legend.labels.color = colors.text;
        categoryChart.update();
    }

    if (spendingTrendsChart) {
        spendingTrendsChart.options.scales.x.ticks.color = colors.text;
        spendingTrendsChart.options.scales.y.ticks.color = colors.text;
        spendingTrendsChart.options.scales.y.grid.color = colors.grid;
        spendingTrendsChart.options.plugins.legend.labels.color = colors.text;
        spendingTrendsChart.update();
    }
}

function drawSpendingTrends(transactions) {
    const canvas = document.getElementById("spendingTrendsChart");
    if (!canvas || typeof Chart === "undefined") return;

    const totals = new Map();
    const now = new Date();
    const labels = [];
    const values = [];
    for (let offset = 11; offset >= 0; offset--) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        labels.push(date.toLocaleDateString(preferredDateLocale, { month: "short" }));
        totals.set(key, 0);
    }
    transactions.forEach(transaction => {
        if (transaction.type !== "expense") return;
        const key = String(transaction.date || "").slice(0, 7);
        if (totals.has(key)) totals.set(key, totals.get(key) + (Number(transaction.amount) || 0));
    });
    labels.forEach((_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        values.push(totals.get(key));
    });

    if (spendingTrendsChart) spendingTrendsChart.destroy();
    const colors = getChartThemeColors();
    spendingTrendsChart = new Chart(canvas, {
        type: "line",
        data: { labels, datasets: [{ label: "Expenses", data: values, borderColor: "#d2ad68", backgroundColor: "rgba(210,173,104,0.15)", fill: true, tension: 0.3 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: colors.text }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: colors.text, callback: value => formatMoney(Number(value)) }, grid: { color: colors.grid } }
            },
            plugins: { legend: { labels: { color: colors.text } } }
        }
    });
}

// ==========================================
// INCOME VS EXPENSE CHART
// ==========================================

function drawIncomeExpenseChart(
    income,
    expenses
) {

    const canvas =
        document.getElementById(
            "incomeExpenseChart"
        );


    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {

        return;

    }


    const chartColors = getChartThemeColors();

    if (incomeExpenseChart) {

        incomeExpenseChart.destroy();

        incomeExpenseChart = null;

    }


    incomeExpenseChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels: [
                        "Income",
                        "Expenses"
                    ],

                    datasets: [{

                        label:
                            "Amount",

                        data: [
                            income,
                            expenses
                        ],

                        backgroundColor: [
                            "#137c68",
                            "#d2ad68"
                        ],

                        borderRadius: 8,

                        maxBarThickness: 56

                    }]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false

                        }

                    },

                    scales: {

                        x: {

                            grid: {
                                display: false
                            },

                            ticks: {
                                color: chartColors.text
                            }

                        },

                        y: {

                            beginAtZero:
                                true,

                            grid: {
                                color: chartColors.grid
                            },

                            ticks: {

                                color: chartColors.text,

                                callback:
                                    function (
                                        value
                                    ) {

                                        return formatMoney(Number(value));

                                    }

                            }

                        }

                    }

                }

            }
        );

}


// ==========================================
// CATEGORY CHART
// ==========================================

function drawCategoryChart(
    transactions
) {

    const canvas =
        document.getElementById(
            "categoryChart"
        );


    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {

        return;

    }


    const chartColors = getChartThemeColors();
    const categoryTotals = {};


    transactions.forEach(
        transaction => {

            if (
                transaction.type !==
                "expense"
            ) {

                return;

            }


            const category =
                transaction.category ||
                "Other";


            const amount =
                Number(
                    transaction.amount
                ) || 0;


            categoryTotals[category] =
                (
                    categoryTotals[
                    category
                    ] || 0
                ) + amount;

        }
    );


    const labels =
        Object.keys(
            categoryTotals
        );


    const values =
        Object.values(
            categoryTotals
        );


    if (categoryChart) {

        categoryChart.destroy();

        categoryChart = null;

    }


    categoryChart =
        new Chart(
            canvas,
            {

                type: "doughnut",

                data: {

                    labels: labels,

                    datasets: [{

                        data: values,

                        backgroundColor: [
                            "#137c68",
                            "#d2ad68",
                            "#527a70",
                            "#b78d4f",
                            "#83aa91",
                            "#748c8c",
                            "#c87560",
                            "#365e66",
                            "#d5c59e"
                        ],

                        borderColor: chartColors.doughnutBorder,

                        borderWidth: 3,

                        hoverOffset: 8

                    }]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            position:
                                "bottom",

                            labels: {
                                color: chartColors.text,
                                padding: 18
                            }

                        }

                    }

                }

            }
        );

}


