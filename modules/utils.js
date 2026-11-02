// ==========================================
// MONEY FORMAT
// ==========================================

function formatMoney(amount) {

    return new Intl.NumberFormat(
        CURRENCY_LOCALES[preferredCurrency],
        {

            style: "currency",

            currency: preferredCurrency,

            minimumFractionDigits: 2,
            maximumFractionDigits: 2

        }
    ).format(amount);

}

function updateAmountPlaceholder() {

    const amountInput =
        document.getElementById("amount");

    if (amountInput) {
        amountInput.placeholder = formatMoney(0);
    }
}


// ==========================================
// DATE FORMAT
// ==========================================

function formatDate(date) {

    const dateValue = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? `${date}T00:00:00`
        : date;

    return new Date(dateValue)
        .toLocaleDateString(
            preferredDateLocale,

            {

                day: "2-digit",

                month: "2-digit",

                year: "numeric"

            }
        );

}


// ==========================================
// SECURITY
// ==========================================

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(value ?? "");

    return div.innerHTML;

}


