let expenses = [];
let latestAIPrompt = "";

const pieColors = [
    "#3498db",
    "#27ae60",
    "#f39c12",
    "#e74c3c",
    "#9b59b6",
    "#1abc9c",
    "#34495e"
];

const budgetCategories = [
    "餐飲",
    "交通",
    "娛樂",
    "購物",
    "學習",
    "生活用品",
    "醫療"
];

let categoryBudgetAmounts = getDefaultCategoryBudgetAmounts();

function getDefaultCategoryBudgetAmounts() {
    return {
        "餐飲": 0,
        "交通": 0,
        "娛樂": 0,
        "購物": 0,
        "學習": 0,
        "生活用品": 0,
        "醫療": 0
    };
}

function migrateBudgetAmountsFromPercents(parsed) {
    const defaults = getDefaultCategoryBudgetAmounts();
    const oldPercents = parsed.categoryBudgetPercents || {};
    const income = Number(parsed.income) || 0;
    const fixedExpense = Number(parsed.fixedExpense) || 0;
    const availableBudget = income - fixedExpense;

    if (availableBudget <= 0) {
        return defaults;
    }

    budgetCategories.forEach(function (category) {
        const percent = Number(oldPercents[category]) || 0;
        defaults[category] = Math.max(0, Math.round(availableBudget * percent / 100));
    });

    return defaults;
}

window.onload = function () {
    setToday();
    loadFromLocalStorage();
    closeCategoryAlertModal();
    renderCategoryBudgetInputs();
    renderTable();
    calculateBudget();
    renderPieChart({}, 0);
    showMenu("basicMenu");
};

function showMenu(menuId) {
    const sections = document.querySelectorAll(".menu-section");
    const buttons = document.querySelectorAll(".menu-btn");
    const menuSelect = document.getElementById("menuSelect");

    sections.forEach(function (section) {
        section.classList.remove("active");
    });

    buttons.forEach(function (button) {
        button.classList.toggle("active", button.dataset.target === menuId);
    });

    if (menuSelect && menuSelect.value !== menuId) {
        menuSelect.value = menuId;
    }

    const targetSection = document.getElementById(menuId);

    if (targetSection) {
        targetSection.classList.add("active");
    }

    if (menuId === "analysisMenu") {
        const categoryTotal = getCategoryTotal();
        const totalExpense = expenses.reduce(function (sum, expense) {
            return sum + expense.amount;
        }, 0);

        renderPieChart(categoryTotal, totalExpense);
    }
}

function setToday() {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("expenseDate").value = today;

    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    document.getElementById("month").value = month;
}

function calculateBudget(showAlert = false) {
    const incomeInput = document.getElementById("income");
    const fixedExpenseInput = document.getElementById("fixedExpense");
    const availableBudgetInput = document.getElementById("availableBudget");

    const incomeRaw = incomeInput.value.trim();
    const fixedExpenseRaw = fixedExpenseInput.value.trim();

    if (incomeRaw === "" && fixedExpenseRaw === "") {
        availableBudgetInput.value = "";
        updateCategoryBudgetPreview();
        saveToLocalStorage();
        return false;
    }

    const income = Number(incomeRaw);
    const fixedExpense = fixedExpenseRaw === "" ? 0 : Number(fixedExpenseRaw);

    if (!Number.isFinite(income) || income <= 0) {
        availableBudgetInput.value = "";
        if (showAlert) {
            alert("本月收入必須大於 0，不能輸入 0 或負數。");
            incomeInput.focus();
        }
        updateCategoryBudgetPreview();
        saveToLocalStorage();
        return false;
    }

    if (!Number.isFinite(fixedExpense) || fixedExpense < 0) {
        availableBudgetInput.value = "";
        if (showAlert) {
            alert("固定支出不能是負數。");
            fixedExpenseInput.focus();
        }
        updateCategoryBudgetPreview();
        saveToLocalStorage();
        return false;
    }

    const availableBudget = income - fixedExpense;

    if (availableBudget <= 0) {
        availableBudgetInput.value = "";
        if (showAlert) {
            alert("可用消費預算必須大於 0，請確認本月收入要大於固定支出。");
            incomeInput.focus();
        }
        updateCategoryBudgetPreview();
        saveToLocalStorage();
        return false;
    }

    availableBudgetInput.value = availableBudget;

    updateCategoryBudgetPreview();
    saveToLocalStorage();
    return true;
}

function getBudgetThresholds() {
    const safeInput = document.getElementById("safeLimit");
    const noticeInput = document.getElementById("noticeLimit");
    const warningInput = document.getElementById("warningLimit");

    let safeLimit = safeInput ? Number(safeInput.value) : 70;
    let noticeLimit = noticeInput ? Number(noticeInput.value) : 90;
    let warningLimit = warningInput ? Number(warningInput.value) : 100;

    if (!Number.isFinite(safeLimit) || safeLimit <= 0) {
        safeLimit = 70;
    }

    if (!Number.isFinite(noticeLimit) || noticeLimit <= 0) {
        noticeLimit = 90;
    }

    if (!Number.isFinite(warningLimit) || warningLimit <= 0) {
        warningLimit = 100;
    }

    return {
        safe: safeLimit,
        notice: noticeLimit,
        warning: warningLimit
    };
}

function onBudgetThresholdInput() {
    updateCategoryBudgetPreview();
    saveToLocalStorage();

    if (hasAnalysisResult()) {
        analyzeExpense(false);
    }
}

function renderCategoryBudgetInputs() {
    const grid = document.getElementById("categoryBudgetGrid");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    budgetCategories.forEach(function (category, index) {
        const budgetValue = Number(categoryBudgetAmounts[category]) || 0;

        grid.innerHTML += `
            <div class="budget-input-card">
                <h4>${escapeHTML(category)}</h4>

                <label>分配金額（元）</label>
                <input
                    type="number"
                    min="0"
                    step="1"
                    id="categoryBudgetAmountInput${index}"
                    value="${budgetValue}"
                    oninput="onCategoryBudgetInput()"
                >
                <div class="budget-amount-text" id="categoryBudgetAmount${index}">已分配：0 元</div>
                <div class="budget-warning-text" id="categoryWarningAmount${index}">輸入金額後會顯示提醒金額</div>
            </div>
        `;
    });

    updateCategoryBudgetPreview();
}

function readCategoryBudgetInputs() {
    const nextAmounts = {};

    budgetCategories.forEach(function (category, index) {
        const input = document.getElementById(`categoryBudgetAmountInput${index}`);
        let value = input ? Number(input.value) : Number(categoryBudgetAmounts[category]) || 0;

        if (!Number.isFinite(value) || value < 0) {
            value = 0;
        }

        nextAmounts[category] = Math.round(value);
    });

    categoryBudgetAmounts = nextAmounts;
    return nextAmounts;
}

function onCategoryBudgetInput() {
    updateCategoryBudgetPreview();
    saveToLocalStorage();

    if (hasAnalysisResult()) {
        analyzeExpense(false);
    }
}

function updateCategoryBudgetPreview() {
    const summary = document.getElementById("budgetPercentSummary");
    const totalText = document.getElementById("availableBudgetTotalText");
    const progressText = document.getElementById("allocationProgressText");
    const progressBar = document.getElementById("allocationProgressBar");
    const progressDetail = document.getElementById("allocationProgressDetail");

    if (!summary) {
        return;
    }

    const amounts = readCategoryBudgetInputs();
    const thresholds = getBudgetThresholds();
    const availableBudget = Number(document.getElementById("availableBudget").value) || 0;

    let allocatedAmount = 0;

    budgetCategories.forEach(function (category, index) {
        const budgetAmount = Number(amounts[category]) || 0;
        const percentOfTotal = availableBudget > 0 ? budgetAmount / availableBudget * 100 : 0;
        const noticeAmount = Math.round(budgetAmount * thresholds.notice / 100);
        const warningAmount = Math.round(budgetAmount * thresholds.warning / 100);
        const amountText = document.getElementById(`categoryBudgetAmount${index}`);
        const warningText = document.getElementById(`categoryWarningAmount${index}`);

        allocatedAmount += budgetAmount;

        if (amountText) {
            amountText.textContent = availableBudget > 0
                ? `已分配：${budgetAmount} 元（約占可用預算 ${percentOfTotal.toFixed(1)}%）`
                : `已分配：${budgetAmount} 元`;
        }

        if (warningText) {
            if (budgetAmount > 0) {
                warningText.textContent = `花到 ${noticeAmount} 元會出現注意提醒，花到 ${warningAmount} 元會出現警告提醒，超過 ${budgetAmount} 元會超支提醒。`;
            } else {
                warningText.textContent = "尚未分配金額，不會產生分類預算提醒。";
            }
        }
    });

    const usedPercent = availableBudget > 0 ? allocatedAmount / availableBudget * 100 : 0;
    const remainingAmount = availableBudget - allocatedAmount;
    const progressWidth = Math.max(0, Math.min(usedPercent, 100));

    if (totalText) {
        totalText.textContent = availableBudget > 0 ? `${availableBudget} 元` : "尚未設定";
    }

    if (progressText) {
        progressText.textContent = `已分配 ${usedPercent.toFixed(1)}%`;
    }

    if (progressBar) {
        progressBar.style.width = progressWidth + "%";
        progressBar.textContent = usedPercent.toFixed(1) + "%";
        progressBar.classList.toggle("allocation-progress-over", usedPercent > 100);
    }

    if (progressDetail) {
        if (availableBudget > 0) {
            progressDetail.textContent = remainingAmount >= 0
                ? `已分配 ${allocatedAmount} 元，剩餘 ${remainingAmount} 元。`
                : `已分配 ${allocatedAmount} 元，超出 ${Math.abs(remainingAmount)} 元。`;
        } else {
            progressDetail.textContent = "請先在基本設定輸入收入與固定支出，並計算可用消費預算。";
        }
    }

    let summaryClass = "budget-ok";
    let message = "請先設定可用消費預算，再輸入各分類分配金額。";

    if (availableBudget > 0) {
        if (allocatedAmount > availableBudget) {
            summaryClass = "budget-over-percent";
            message = `目前已分配 ${allocatedAmount} 元，已超過可用預算 ${Math.abs(remainingAmount)} 元，請調低部分分類金額。`;
        } else if (allocatedAmount < availableBudget) {
            summaryClass = "budget-under-percent";
            message = `目前已分配 ${allocatedAmount} 元，尚有 ${remainingAmount} 元未分配。`;
        } else {
            message = `目前已分配 ${allocatedAmount} 元，已剛好分配完可用預算。`;
        }
    }

    summary.className = `budget-percent-summary ${summaryClass}`;
    summary.innerHTML = message;
}

function saveCategoryBudgetSettings() {
    updateCategoryBudgetPreview();
    saveToLocalStorage();
    alert("預算分配已儲存。");
}

function addExpense() {
    const date = document.getElementById("expenseDate").value;
    const itemName = document.getElementById("itemName").value.trim();
    const amountInput = document.getElementById("amount");
    const amount = Number(amountInput.value);
    const category = document.getElementById("category").value;
    const necessary = document.getElementById("necessary").value;
    const note = document.getElementById("note").value.trim();

    if (date === "") {
        alert("請輸入日期");
        return;
    }

    if (itemName === "") {
        alert("請輸入消費項目");
        return;
    }

    if (amountInput.value.trim() === "" || !Number.isFinite(amount) || amount <= 0) {
        alert("消費金額必須大於 0，不能輸入 0 或負數。");
        amountInput.value = "";
        amountInput.focus();
        return;
    }

    if (!budgetCategories.includes(category)) {
        alert("請選擇正確的消費分類。");
        return;
    }

    if (!calculateBudget(true)) {
        return;
    }

    const expense = {
        date: date,
        itemName: itemName,
        amount: amount,
        category: category,
        necessary: necessary,
        note: note
    };

    expenses.push(expense);

    clearInput();
    renderTable();
    saveToLocalStorage();

    if (hasAnalysisResult()) {
        analyzeExpense();
    }

    showCategoryBudgetPopupForCategory(category);
}

function clearInput() {
    document.getElementById("itemName").value = "";
    document.getElementById("amount").value = "";
    document.getElementById("note").value = "";
    document.getElementById("category").value = "餐飲";
    document.getElementById("necessary").value = "必要";
}

function renderTable() {
    const table = document.getElementById("expenseTable");

    table.innerHTML = "";

    expenses.forEach(function (expense, index) {
        const row = `
            <tr>
                <td>${escapeHTML(expense.date)}</td>
                <td>${escapeHTML(expense.itemName)}</td>
                <td>${expense.amount}</td>
                <td>${escapeHTML(expense.category)}</td>
                <td>${escapeHTML(expense.necessary)}</td>
                <td>${escapeHTML(expense.note)}</td>
                <td>
                    <button class="danger-btn" onclick="deleteExpense(${index})">刪除</button>
                </td>
            </tr>
        `;

        table.innerHTML += row;
    });
}

function deleteExpense(index) {
    expenses.splice(index, 1);

    renderTable();
    saveToLocalStorage();

    if (hasAnalysisResult()) {
        analyzeExpense();
    }
}

function analyzeExpense(showAlert = true) {
    if (!calculateBudget(showAlert)) {
        return false;
    }

    const month = document.getElementById("month").value;
    const income = Number(document.getElementById("income").value) || 0;
    const fixedExpense = Number(document.getElementById("fixedExpense").value) || 0;
    const availableBudget = Number(document.getElementById("availableBudget").value) || 0;

    const thresholds = getBudgetThresholds();
    const safeLimit = thresholds.safe;
    const noticeLimit = thresholds.notice;
    const warningLimit = thresholds.warning;

    const totalExpense = expenses.reduce(function (sum, expense) {
        return sum + expense.amount;
    }, 0);

    const necessaryExpense = expenses
        .filter(function (expense) {
            return expense.necessary === "必要";
        })
        .reduce(function (sum, expense) {
            return sum + expense.amount;
        }, 0);

    const unnecessaryExpense = expenses
        .filter(function (expense) {
            return expense.necessary === "非必要";
        })
        .reduce(function (sum, expense) {
            return sum + expense.amount;
        }, 0);

    let usedRatio = 0;

    if (availableBudget > 0) {
        usedRatio = totalExpense / availableBudget * 100;
    }

    const categoryTotal = getCategoryTotal();

    let categoryText = "";

    for (let category in categoryTotal) {
        const percent = totalExpense > 0
            ? (categoryTotal[category] / totalExpense * 100).toFixed(2)
            : 0;

        categoryText += `${escapeHTML(category)}：${categoryTotal[category]} 元，占 ${percent}%<br>`;
    }

    const budgetCheck = getCategoryBudgetCheck(availableBudget, categoryTotal);

    let maxCategory = "無";
    let maxAmount = 0;

    for (let category in categoryTotal) {
        if (categoryTotal[category] > maxAmount) {
            maxAmount = categoryTotal[category];
            maxCategory = category;
        }
    }

    let status = "";
    let statusClass = "";
    if (usedRatio < safeLimit) {
        status = "安全";
        statusClass = "safe";
    } else if (usedRatio < noticeLimit) {
        status = "注意";
        statusClass = "notice";
    } else if (usedRatio < warningLimit) {
        status = "警告";
        statusClass = "warning";
    } else {
        status = "超支";
        statusClass = "over";
    }

    const remainingBudget = availableBudget - totalExpense;


    document.getElementById("analysisResult").innerHTML = `
        <strong>分析月份：</strong>${escapeHTML(month)}<br>
        <strong>本月收入：</strong>${income} 元<br>
        <strong>固定支出：</strong>${fixedExpense} 元<br>
        <strong>可用消費預算：</strong>${availableBudget} 元<br>
        <strong>消費總額：</strong>${totalExpense} 元<br>
        <strong>必要支出：</strong>${necessaryExpense} 元<br>
        <strong>非必要支出：</strong>${unnecessaryExpense} 元<br>
        <strong>已使用預算比例：</strong>${usedRatio.toFixed(2)}%<br>
        <strong>剩餘預算：</strong>${remainingBudget} 元<br>
        <strong>最大支出分類：</strong>${escapeHTML(maxCategory)}，共 ${maxAmount} 元<br><br>

        <strong>分類統計：</strong><br>
        ${categoryText || "目前沒有消費資料"}<br>

        <strong>分類預算執行情況：</strong><br>
        ${budgetCheck.html || "尚未設定分類預算"}
    `;

    updateBudgetBar(usedRatio);
    renderPieChart(categoryTotal, totalExpense);

    const categoryWarningSummary = getCategoryWarningSummary(budgetCheck);

    document.getElementById("warningBox").innerHTML = `
        <div class="result-box ${statusClass}">
            預警狀態：${status}
            ${categoryWarningSummary ? `<br>${categoryWarningSummary}` : ""}
        </div>
    `;

    generateAIPrompt(
        month,
        income,
        fixedExpense,
        availableBudget,
        totalExpense,
        usedRatio,
        status,
        maxCategory,
        remainingBudget,
        budgetCheck.text
    );

    saveToLocalStorage();
    return true;
}

function updateBudgetBar(usedRatio) {
    const bar = document.getElementById("budgetBar");

    let barWidth = usedRatio;

    if (barWidth > 100) {
        barWidth = 100;
    }

    bar.style.width = barWidth + "%";
    bar.textContent = usedRatio.toFixed(2) + "%";
}

function getCategoryTotal() {
    const categoryTotal = {};

    expenses.forEach(function (expense) {
        if (!budgetCategories.includes(expense.category)) {
            return;
        }

        if (!categoryTotal[expense.category]) {
            categoryTotal[expense.category] = 0;
        }

        categoryTotal[expense.category] += expense.amount;
    });

    return categoryTotal;
}

function getCategoryBudgetCheck(availableBudget, categoryTotal) {
    const amounts = readCategoryBudgetInputs();
    const thresholds = getBudgetThresholds();
    const rows = [];
    const warningCategories = [];
    const overBudgetCategories = [];

    let html = "";
    let text = "";
    let totalBudgetAmount = 0;

    budgetCategories.forEach(function (category) {
        const budgetAmount = Number(amounts[category]) || 0;
        const safeAmount = Math.round(budgetAmount * thresholds.safe / 100);
        const noticeAmount = Math.round(budgetAmount * thresholds.notice / 100);
        const warningAmount = Math.round(budgetAmount * thresholds.warning / 100);
        const spent = Number(categoryTotal[category]) || 0;
        const remaining = budgetAmount - spent;
        const usedPercent = budgetAmount > 0 ? spent / budgetAmount * 100 : 0;
        const budgetPercent = availableBudget > 0 ? budgetAmount / availableBudget * 100 : 0;

        totalBudgetAmount += budgetAmount;

        if (budgetAmount > 0 || spent > 0) {
            let status = "正常";

            if (budgetAmount > 0 && spent > budgetAmount) {
                status = "超出";
                overBudgetCategories.push(category);
            } else if (budgetAmount === 0 && spent > 0) {
                status = "未分配預算但有支出";
                overBudgetCategories.push(category);
            } else if (budgetAmount > 0 && spent >= warningAmount && spent > 0) {
                status = "警告";
                warningCategories.push(category);
            } else if (budgetAmount > 0 && spent >= noticeAmount && spent > 0) {
                status = "注意";
                warningCategories.push(category);
            } else if (spent > 0) {
                status = "安全";
            }

            rows.push({
                category: category,
                budgetAmount: budgetAmount,
                budgetPercent: budgetPercent,
                safePercent: thresholds.safe,
                noticePercent: thresholds.notice,
                warningPercent: thresholds.warning,
                safeAmount: safeAmount,
                noticeAmount: noticeAmount,
                warningAmount: warningAmount,
                spent: spent,
                remaining: remaining,
                usedPercent: usedPercent,
                status: status
            });
        }
    });

    rows.forEach(function (row) {
        const usedText = row.budgetAmount > 0 ? `${row.usedPercent.toFixed(1)}%` : "-";
        let statusClass = "category-budget-normal";

        if (row.status === "注意" || row.status === "警告") {
            statusClass = "category-budget-warning";
        } else if (row.status !== "正常" && row.status !== "安全") {
            statusClass = "category-budget-over";
        }

        html += `
            <div class="category-budget-row ${statusClass}">
                <div>
                    <strong>${escapeHTML(row.category)}</strong>
                    <span>預算 ${row.budgetAmount} 元｜注意 ${row.noticeAmount} 元｜警告 ${row.warningAmount} 元｜已花 ${row.spent} 元｜剩餘 ${row.remaining} 元</span>
                </div>
                <b>${escapeHTML(row.status)}｜${usedText}</b>
            </div>
        `;

        text += `${row.category}：預算 ${row.budgetAmount} 元、占可用預算 ${row.budgetPercent.toFixed(1)}%、注意提醒 ${row.noticeAmount} 元、警告提醒 ${row.warningAmount} 元、已花 ${row.spent} 元、剩餘 ${row.remaining} 元、狀態 ${row.status}\n`;
    });

    text = `分類預算總金額：${totalBudgetAmount} 元\n共用預警門檻：安全 ${thresholds.safe}%、注意 ${thresholds.notice}%、警告 ${thresholds.warning}%\n` + text;

    return {
        html: html,
        text: text,
        rows: rows,
        warningCategories: warningCategories,
        overBudgetCategories: overBudgetCategories
    };
}

function renderPieChart(categoryTotal, totalExpense) {
    const canvas = document.getElementById("categoryPieChart");
    const legend = document.getElementById("chartLegend");
    const hint = document.getElementById("chartHint");

    if (!canvas || !legend || !hint) {
        return;
    }

    const wrap = canvas.parentElement;
    const displaySize = Math.min(wrap.clientWidth || 280, 330);
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = displaySize + "px";
    canvas.style.height = displaySize + "px";
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displaySize, displaySize);

    const center = displaySize / 2;
    const radius = displaySize * 0.36;
    const categories = Object.keys(categoryTotal);

    legend.innerHTML = "";

    if (totalExpense <= 0 || categories.length === 0) {
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#e5e7eb";
        ctx.fill();
        ctx.fillStyle = "#6b7280";
        ctx.font = "16px Microsoft JhengHei, Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("尚無資料", center, center);

        legend.innerHTML = `<div class="empty-chart-text">目前沒有分類資料</div>`;
        hint.textContent = "目前沒有消費資料，新增資料後按「開始分析」即可產生圓餅圖。";
        return;
    }

    let startAngle = -Math.PI / 2;

    categories.forEach(function (category, index) {
        const value = categoryTotal[category];
        const percent = value / totalExpense;
        const endAngle = startAngle + percent * Math.PI * 2;
        const color = pieColors[index % pieColors.length];

        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        const percentText = (percent * 100).toFixed(1);

        if (percent >= 0.06) {
            const midAngle = (startAngle + endAngle) / 2;
            const textX = center + Math.cos(midAngle) * radius * 0.75;
            const textY = center + Math.sin(midAngle) * radius * 0.75;

            ctx.fillStyle = "#000000";
            ctx.font = "bold 10px Microsoft JhengHei, Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(percentText + "%", textX, textY);
        }

        startAngle = endAngle;

        legend.innerHTML += `
            <div class="legend-item">
                <div class="legend-left">
                    <span class="legend-color" style="background-color: ${color};"></span>
                    <span class="legend-name">${escapeHTML(category)}</span>
                </div>
                <span class="legend-value">${value} 元｜${percentText}%</span>
            </div>
        `;
    });

    ctx.beginPath();
    ctx.arc(center, center, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.fillStyle = "#2c3e50";
    ctx.font = "bold 16px Microsoft JhengHei, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("總支出", center, center - 10);

    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Microsoft JhengHei, Arial";
    ctx.fillText(totalExpense + " 元", center, center + 13);

    hint.textContent = "圓餅圖會根據分類支出自動更新，比例越大代表該分類支出越高。";
}

function generateAIPrompt(
    month,
    income,
    fixedExpense,
    availableBudget,
    totalExpense,
    usedRatio,
    status,
    maxCategory,
    remainingBudget,
    categoryBudgetText
) {
    let expenseText = "";

    expenses.forEach(function (expense) {
        expenseText += `${expense.date}｜${expense.itemName}｜${expense.amount}元｜${expense.category}｜${expense.necessary}｜${expense.note}\n`;
    });

    const prompt = `
請你扮演個人消費分析師，根據以下記帳資料給我簡短、重點式分析。
請控制在 150 字以內，不要開頭寒暄，不要寫太長。

月份：${month}
本月收入：${income} 元
固定支出：${fixedExpense} 元
可用消費預算：${availableBudget} 元
目前總消費：${totalExpense} 元
已使用預算比例：${usedRatio.toFixed(2)}%
目前狀態：${status}
最大支出分類：${maxCategory}
剩餘預算：${remainingBudget} 元

分類預算分配與執行情況：
${categoryBudgetText || "尚未設定分類預算"}

消費明細：
${expenseText}

請只回答以下三點：
1. 消費狀況：用一句話說明。
2. 主要問題：指出是否有分類預算超支。
3. 改善建議：列出 2 點即可。
    `;

    latestAIPrompt = prompt.trim();
}

function saveToLocalStorage() {
    if (document.getElementById("categoryBudgetGrid")) {
        readCategoryBudgetInputs();
    }

    const data = {
        month: document.getElementById("month").value,
        income: document.getElementById("income").value,
        fixedExpense: document.getElementById("fixedExpense").value,
        safeLimit: document.getElementById("safeLimit").value,
        noticeLimit: document.getElementById("noticeLimit").value,
        warningLimit: document.getElementById("warningLimit").value,
        categoryBudgetAmounts: categoryBudgetAmounts,
        expenses: expenses
    };

    localStorage.setItem("budgetData", JSON.stringify(data));
}

function loadFromLocalStorage() {
    const data = localStorage.getItem("budgetData");

    if (!data) {
        return;
    }

    const parsed = JSON.parse(data);

    document.getElementById("month").value = parsed.month || "";
    document.getElementById("income").value = parsed.income || "";
    document.getElementById("fixedExpense").value = parsed.fixedExpense || "";
    document.getElementById("safeLimit").value = parsed.safeLimit || 70;
    document.getElementById("noticeLimit").value = parsed.noticeLimit || 90;
    document.getElementById("warningLimit").value = parsed.warningLimit || 100;

    if (parsed.categoryBudgetAmounts) {
        categoryBudgetAmounts = {
            ...getDefaultCategoryBudgetAmounts(),
            ...parsed.categoryBudgetAmounts
        };
    } else {
        categoryBudgetAmounts = migrateBudgetAmountsFromPercents(parsed);
    }

    expenses = (parsed.expenses || [])
        .map(function (expense) {
            return {
                ...expense,
                amount: Number(expense.amount)
            };
        })
        .filter(function (expense) {
            return Number.isFinite(expense.amount)
                && expense.amount > 0
                && budgetCategories.includes(expense.category);
        });
}

function clearAll() {
    const confirmClear = confirm("確定要清空所有資料嗎？");

    if (!confirmClear) {
        return;
    }

    expenses = [];
    categoryBudgetAmounts = getDefaultCategoryBudgetAmounts();

    localStorage.removeItem("budgetData");

    document.getElementById("income").value = "";
    document.getElementById("fixedExpense").value = "";
    document.getElementById("availableBudget").value = "";
    document.getElementById("safeLimit").value = 70;
    document.getElementById("noticeLimit").value = 90;
    document.getElementById("warningLimit").value = 100;
    document.getElementById("analysisResult").innerHTML = "";
    document.getElementById("warningBox").innerHTML = "";
    latestAIPrompt = "";
    document.getElementById("geminiResult").innerHTML = "尚未產生 AI 分析結果。";

    const bar = document.getElementById("budgetBar");
    bar.style.width = "0%";
    bar.textContent = "0%";

    closeCategoryAlertModal();
    renderCategoryBudgetInputs();
    renderTable();
    renderPieChart({}, 0);
    setToday();
}

function hasAnalysisResult() {
    return document.getElementById("analysisResult").innerHTML.trim() !== "";
}

function getCategoryWarningSummary(budgetCheck) {
    if (budgetCheck.overBudgetCategories.length > 0) {
        return `<span class="category-warning-red">分類預算警示：${escapeHTML(budgetCheck.overBudgetCategories.join("、"))} 已超出分類預算。</span>`;
    }

    if (budgetCheck.warningCategories.length > 0) {
        return `<span class="category-warning-red">分類預算提醒：${escapeHTML(budgetCheck.warningCategories.join("、"))} 已達警示門檻。</span>`;
    }

    return "";
}

function getCategoryBudgetAlert(category) {
    if (!budgetCategories.includes(category)) {
        return null;
    }

    const availableBudget = Number(document.getElementById("availableBudget").value) || 0;

    if (availableBudget <= 0) {
        return null;
    }

    const categoryTotal = getCategoryTotal();
    const budgetCheck = getCategoryBudgetCheck(availableBudget, categoryTotal);

    return budgetCheck.rows.find(function (row) {
        return row.category === category && row.status !== "正常" && row.status !== "安全";
    }) || null;
}

function showCategoryBudgetPopupForCategory(category) {
    const row = getCategoryBudgetAlert(category);

    if (!row) {
        return;
    }

    const modal = document.getElementById("categoryAlertModal");
    const title = document.getElementById("categoryAlertTitle");
    const content = document.getElementById("categoryAlertContent");

    const isNotice = row.status === "注意";
    const isWarning = row.status === "警告";
    const isOver = !isNotice && !isWarning;
    const statusText = isOver ? "超出分類預算" : (isWarning ? "達到警告提醒金額" : "達到注意提醒金額");

    if (!modal || !title || !content) {
        alert(`${row.category} 已${statusText}，目前已花 ${row.spent} 元，分類預算為 ${row.budgetAmount} 元。`);
        return;
    }

    title.textContent = isOver ? "分類預算超支提醒" : (isWarning ? "分類預算警告提醒" : "分類預算注意提醒");
    content.className = `modal-content ${isOver ? "modal-over" : "modal-warning"}`;
    content.innerHTML = `
        <p><strong>${escapeHTML(row.category)}</strong> 已${statusText}。</p>
        <ul>
            <li>分類預算：${row.budgetAmount} 元</li>
            <li>注意提醒：花到 ${row.noticeAmount} 元</li>
            <li>警告提醒：花到 ${row.warningAmount} 元</li>
            <li>目前已花：${row.spent} 元</li>
            <li>剩餘金額：${row.remaining} 元</li>
        </ul>
        <p>${isOver ? "建議先暫停或減少此分類支出。" : "建議接下來控制此分類支出，避免月底超支。"}</p>
    `;

    modal.classList.remove("hidden");
}

function closeCategoryAlertModal() {
    const modal = document.getElementById("categoryAlertModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function askGeminiAnalysis() {
    if (!analyzeExpense(true)) {
        return;
    }

    const prompt = latestAIPrompt;
    const resultBox = document.getElementById("geminiResult");
    const button = document.getElementById("geminiButton");

    if (!prompt.trim()) {
        alert("請先新增消費資料並按下開始分析");
        return;
    }

    resultBox.innerHTML = "AI 分析中，請稍候...";
    button.disabled = true;
    button.textContent = "分析中...";

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt
            })
        });

        let data;

        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error("後端沒有回傳正確 JSON，請確認是否已執行 Node.js 伺服器，並用 http://localhost:3000 開啟。");
        }

        if (!response.ok || data.error) {
            throw new Error(data.error || "AI 分析失敗");
        }

        resultBox.innerHTML = formatAIText(data.result);
    } catch (error) {
        resultBox.innerHTML = `
            <div class="ai-error">
                AI 分析失敗：${escapeHTML(error.message)}<br>
                請確認：<br>
                1. 已經建立 .env 並設定 GEMINI_API_KEY。<br>
                2. 已經執行 node server.js。<br>
                3. 網頁是透過 http://localhost:3000 開啟，不是直接雙擊 HTML。<br>
                4. 電腦可以連上 AI API。
            </div>
        `;
    } finally {
        button.disabled = false;
        button.textContent = "產生 AI 消費分析";
    }
}

function formatAIText(text) {
    return escapeHTML(text)
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

window.addEventListener("resize", function () {
    const categoryTotal = getCategoryTotal();
    const totalExpense = expenses.reduce(function (sum, expense) {
        return sum + expense.amount;
    }, 0);

    renderPieChart(categoryTotal, totalExpense);
});
