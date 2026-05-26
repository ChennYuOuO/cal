let expenses = [];

const pieColors = [
    "#3498db",
    "#27ae60",
    "#f39c12",
    "#e74c3c",
    "#9b59b6",
    "#1abc9c",
    "#34495e",
    "#e67e22"
];

const budgetCategories = [
    "餐飲",
    "交通",
    "娛樂",
    "購物",
    "學習",
    "生活用品",
    "醫療",
    "其他"
];

let categoryBudgetPercents = getDefaultCategoryBudgetPercents();
let categoryWarningPercents = getDefaultCategoryWarningPercents();

function getDefaultCategoryBudgetPercents() {
    return {
        "餐飲": 30,
        "交通": 15,
        "娛樂": 10,
        "購物": 15,
        "學習": 10,
        "生活用品": 10,
        "醫療": 5,
        "其他": 5
    };
}

function getDefaultCategoryWarningPercents() {
    return {
        "餐飲": 80,
        "交通": 80,
        "娛樂": 80,
        "購物": 80,
        "學習": 80,
        "生活用品": 80,
        "醫療": 80,
        "其他": 80
    };
}

window.onload = function () {
    setToday();
    loadFromLocalStorage();
    closeCategoryAlertModal();
    renderCategoryBudgetInputs();
    renderTable();
    calculateBudget();
    renderPieChart({}, 0);
};

function setToday() {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("expenseDate").value = today;

    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    document.getElementById("month").value = month;
}

function calculateBudget() {
    const income = Number(document.getElementById("income").value) || 0;
    const fixedExpense = Number(document.getElementById("fixedExpense").value) || 0;

    const availableBudget = income - fixedExpense;

    document.getElementById("availableBudget").value = availableBudget;

    updateCategoryBudgetPreview();
    saveToLocalStorage();
}

function renderCategoryBudgetInputs() {
    const grid = document.getElementById("categoryBudgetGrid");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    budgetCategories.forEach(function (category, index) {
        const budgetValue = Number(categoryBudgetPercents[category]) || 0;
        const warningValue = Number(categoryWarningPercents[category]) || 80;

        grid.innerHTML += `
            <div class="budget-input-card">
                <h4>${escapeHTML(category)}</h4>

                <label>預算比例 (%)</label>
                <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    id="categoryBudgetPercent${index}"
                    value="${budgetValue}"
                    oninput="onCategoryBudgetInput()"
                >
                <div class="budget-amount-text" id="categoryBudgetAmount${index}">預算金額：0 元</div>

                <label>警示門檻 (%)</label>
                <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    id="categoryWarningPercent${index}"
                    value="${warningValue}"
                    oninput="onCategoryBudgetInput()"
                >
                <div class="budget-warning-text" id="categoryWarningAmount${index}">提醒金額：0 元</div>
            </div>
        `;
    });

    updateCategoryBudgetPreview();
}

function readCategoryBudgetInputs() {
    const nextPercents = {};

    budgetCategories.forEach(function (category, index) {
        const input = document.getElementById(`categoryBudgetPercent${index}`);
        let value = input ? Number(input.value) : Number(categoryBudgetPercents[category]) || 0;

        if (!Number.isFinite(value) || value < 0) {
            value = 0;
        }

        nextPercents[category] = value;
    });

    categoryBudgetPercents = nextPercents;
    return nextPercents;
}

function readCategoryWarningInputs() {
    const nextWarnings = {};

    budgetCategories.forEach(function (category, index) {
        const input = document.getElementById(`categoryWarningPercent${index}`);
        let value = input ? Number(input.value) : Number(categoryWarningPercents[category]) || 80;

        if (!Number.isFinite(value)) {
            value = 80;
        }

        if (value < 1) {
            value = 1;
        }

        if (value > 100) {
            value = 100;
        }

        nextWarnings[category] = value;
    });

    categoryWarningPercents = nextWarnings;
    return nextWarnings;
}

function onCategoryBudgetInput() {
    updateCategoryBudgetPreview();
    saveToLocalStorage();

    if (hasAnalysisResult()) {
        analyzeExpense();
    }
}

function updateCategoryBudgetPreview() {
    const summary = document.getElementById("budgetPercentSummary");

    if (!summary) {
        return;
    }

    const percents = readCategoryBudgetInputs();
    const warnings = readCategoryWarningInputs();
    const availableBudget = Number(document.getElementById("availableBudget").value) || 0;

    let totalPercent = 0;

    budgetCategories.forEach(function (category, index) {
        const percent = Number(percents[category]) || 0;
        const amount = availableBudget > 0 ? availableBudget * percent / 100 : 0;
        const warningPercent = Number(warnings[category]) || 80;
        const warningAmount = amount * warningPercent / 100;
        const amountText = document.getElementById(`categoryBudgetAmount${index}`);
        const warningText = document.getElementById(`categoryWarningAmount${index}`);

        totalPercent += percent;

        if (amountText) {
            amountText.textContent = `預算金額：約 ${Math.round(amount)} 元`;
        }

        if (warningText) {
            warningText.textContent = `提醒金額：約 ${Math.round(warningAmount)} 元（達 ${warningPercent}% 跳出）`;
        }
    });

    const remainingPercent = 100 - totalPercent;
    let summaryClass = "budget-ok";
    let message = `目前已分配 ${totalPercent.toFixed(1)}%，剩餘 ${remainingPercent.toFixed(1)}%。`;

    if (totalPercent > 100) {
        summaryClass = "budget-over-percent";
        message = `目前已分配 ${totalPercent.toFixed(1)}%，已超過 100%，請調低部分分類比例。`;
    } else if (totalPercent < 100) {
        summaryClass = "budget-under-percent";
        message = `目前已分配 ${totalPercent.toFixed(1)}%，尚有 ${remainingPercent.toFixed(1)}% 未分配。`;
    }

    summary.className = `budget-percent-summary ${summaryClass}`;
    summary.innerHTML = message;
}

function resetCategoryBudgetPercents() {
    categoryBudgetPercents = getDefaultCategoryBudgetPercents();
    categoryWarningPercents = getDefaultCategoryWarningPercents();
    renderCategoryBudgetInputs();
    saveToLocalStorage();

    if (hasAnalysisResult()) {
        analyzeExpense();
    }
}

function addExpense() {
    const date = document.getElementById("expenseDate").value;
    const itemName = document.getElementById("itemName").value.trim();
    const amount = Number(document.getElementById("amount").value);
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

    if (amount <= 0) {
        alert("請輸入正確金額");
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

function analyzeExpense() {
    calculateBudget();

    const month = document.getElementById("month").value;
    const income = Number(document.getElementById("income").value) || 0;
    const fixedExpense = Number(document.getElementById("fixedExpense").value) || 0;
    const availableBudget = Number(document.getElementById("availableBudget").value) || 0;

    const safeLimit = Number(document.getElementById("safeLimit").value) || 70;
    const noticeLimit = Number(document.getElementById("noticeLimit").value) || 90;
    const warningLimit = Number(document.getElementById("warningLimit").value) || 100;

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
    let advice = "";

    if (usedRatio < safeLimit) {
        status = "安全";
        statusClass = "safe";
        advice = "目前消費狀況良好，可以繼續維持。";
    } else if (usedRatio < noticeLimit) {
        status = "注意";
        statusClass = "notice";
        advice = "已進入注意區間，建議開始控制非必要支出。";
    } else if (usedRatio < warningLimit) {
        status = "警告";
        statusClass = "warning";
        advice = "已接近預算上限，建議減少娛樂、購物、飲料等支出。";
    } else {
        status = "超支";
        statusClass = "over";
        advice = "已經超過可用消費預算，建議重新檢討本月支出。";
    }

    const remainingBudget = availableBudget - totalExpense;

    let unnecessaryRatio = 0;

    if (totalExpense > 0) {
        unnecessaryRatio = unnecessaryExpense / totalExpense * 100;
    }

    let extraAdvice = "";

    if (budgetCheck.overBudgetCategories.length > 0) {
        extraAdvice = `「${budgetCheck.overBudgetCategories.join("、")}」已超出分類預算，建議優先檢查這些項目。`;
    } else if (budgetCheck.warningCategories.length > 0) {
        extraAdvice = `「${budgetCheck.warningCategories.join("、")}」已達分類警示門檻，建議提早控制支出。`;
    } else if (unnecessaryRatio >= 40) {
        extraAdvice = "非必要支出比例偏高，建議優先檢查娛樂、購物、飲料等項目。";
    } else if (unnecessaryRatio > 0) {
        extraAdvice = "非必要支出比例尚可，但仍可檢查是否有能減少的消費。";
    } else {
        extraAdvice = "目前沒有非必要支出紀錄。";
    }

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
        ${budgetCheck.html || "尚未設定分類預算"}<br>

        <strong>系統建議：</strong><br>
        1. ${advice}<br>
        2. ${extraAdvice}<br>
        3. 最大支出分類是「${escapeHTML(maxCategory)}」，可以優先檢討這類支出。
    `;

    updateBudgetBar(usedRatio);
    renderPieChart(categoryTotal, totalExpense);

    const categoryWarningSummary = getCategoryWarningSummary(budgetCheck);

    document.getElementById("warningBox").innerHTML = `
        <div class="result-box ${statusClass}">
            預警狀態：${status}<br>
            ${advice}
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
        if (!categoryTotal[expense.category]) {
            categoryTotal[expense.category] = 0;
        }

        categoryTotal[expense.category] += expense.amount;
    });

    return categoryTotal;
}

function getCategoryBudgetCheck(availableBudget, categoryTotal) {
    const percents = readCategoryBudgetInputs();
    const warnings = readCategoryWarningInputs();
    const rows = [];
    const warningCategories = [];
    const overBudgetCategories = [];

    let html = "";
    let text = "";
    let totalPercent = 0;

    budgetCategories.forEach(function (category) {
        const percent = Number(percents[category]) || 0;
        const warningPercent = Number(warnings[category]) || 80;
        const budgetAmount = availableBudget > 0 ? Math.round(availableBudget * percent / 100) : 0;
        const warningAmount = Math.round(budgetAmount * warningPercent / 100);
        const spent = Number(categoryTotal[category]) || 0;
        const remaining = budgetAmount - spent;
        const usedPercent = budgetAmount > 0 ? spent / budgetAmount * 100 : 0;

        totalPercent += percent;

        if (percent > 0 || spent > 0) {
            let status = "正常";

            if (budgetAmount > 0 && spent > budgetAmount) {
                status = "超出";
                overBudgetCategories.push(category);
            } else if (budgetAmount === 0 && spent > 0) {
                status = "未分配預算但有支出";
                overBudgetCategories.push(category);
            } else if (budgetAmount > 0 && spent >= warningAmount && spent > 0) {
                status = "注意";
                warningCategories.push(category);
            }

            rows.push({
                category: category,
                percent: percent,
                warningPercent: warningPercent,
                budgetAmount: budgetAmount,
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

        if (row.status === "注意") {
            statusClass = "category-budget-warning";
        } else if (row.status !== "正常") {
            statusClass = "category-budget-over";
        }

        html += `
            <div class="category-budget-row ${statusClass}">
                <div>
                    <strong>${escapeHTML(row.category)}</strong>
                    <span>${row.percent}%｜預算 ${row.budgetAmount} 元｜警示 ${row.warningAmount} 元｜已花 ${row.spent} 元｜剩餘 ${row.remaining} 元</span>
                </div>
                <b>${escapeHTML(row.status)}｜${usedText}</b>
            </div>
        `;

        text += `${row.category}：設定 ${row.percent}%、預算 ${row.budgetAmount} 元、警示門檻 ${row.warningPercent}%（${row.warningAmount} 元）、已花 ${row.spent} 元、剩餘 ${row.remaining} 元、狀態 ${row.status}
`;
    });

    text = `分類預算總比例：${totalPercent.toFixed(1)}%
` + text;

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
        ctx.lineWidth = 3;
        ctx.stroke();

        startAngle = endAngle;

        const percentText = (percent * 100).toFixed(2);
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

    document.getElementById("aiPrompt").value = prompt.trim();
}

function saveToLocalStorage() {
    if (document.getElementById("categoryBudgetGrid")) {
        readCategoryBudgetInputs();
        readCategoryWarningInputs();
    }

    const data = {
        month: document.getElementById("month").value,
        income: document.getElementById("income").value,
        fixedExpense: document.getElementById("fixedExpense").value,
        safeLimit: document.getElementById("safeLimit").value,
        noticeLimit: document.getElementById("noticeLimit").value,
        warningLimit: document.getElementById("warningLimit").value,
        categoryBudgetPercents: categoryBudgetPercents,
        categoryWarningPercents: categoryWarningPercents,
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

    categoryBudgetPercents = {
        ...getDefaultCategoryBudgetPercents(),
        ...(parsed.categoryBudgetPercents || {})
    };

    categoryWarningPercents = {
        ...getDefaultCategoryWarningPercents(),
        ...(parsed.categoryWarningPercents || {})
    };

    expenses = parsed.expenses || [];
}

function clearAll() {
    const confirmClear = confirm("確定要清空所有資料嗎？");

    if (!confirmClear) {
        return;
    }

    expenses = [];
    categoryBudgetPercents = getDefaultCategoryBudgetPercents();
    categoryWarningPercents = getDefaultCategoryWarningPercents();

    localStorage.removeItem("budgetData");

    document.getElementById("income").value = "";
    document.getElementById("fixedExpense").value = "";
    document.getElementById("availableBudget").value = "";
    document.getElementById("analysisResult").innerHTML = "";
    document.getElementById("warningBox").innerHTML = "";
    document.getElementById("aiPrompt").value = "";
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
        return `分類預算警示：${escapeHTML(budgetCheck.overBudgetCategories.join("、"))} 已超出分類預算。`;
    }

    if (budgetCheck.warningCategories.length > 0) {
        return `分類預算提醒：${escapeHTML(budgetCheck.warningCategories.join("、"))} 已達警示門檻。`;
    }

    return "";
}

function getCategoryBudgetAlert(category) {
    const availableBudget = Number(document.getElementById("availableBudget").value) || 0;

    if (availableBudget <= 0) {
        return null;
    }

    const categoryTotal = getCategoryTotal();
    const budgetCheck = getCategoryBudgetCheck(availableBudget, categoryTotal);

    return budgetCheck.rows.find(function (row) {
        return row.category === category && row.status !== "正常";
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

    if (!modal || !title || !content) {
        const message = row.status === "注意"
            ? `${row.category} 已達分類預算警示門檻，目前已花 ${row.spent} 元，警示金額為 ${row.warningAmount} 元。`
            : `${row.category} 已超出分類預算，目前已花 ${row.spent} 元，預算為 ${row.budgetAmount} 元。`;
        alert(message);
        return;
    }

    const isOver = row.status !== "注意";
    title.textContent = isOver ? "分類預算超支提醒" : "分類預算注意提醒";
    content.className = `modal-content ${isOver ? "modal-over" : "modal-warning"}`;
    content.innerHTML = `
        <p><strong>${escapeHTML(row.category)}</strong> 已${isOver ? "超出分類預算" : "達到警示門檻"}。</p>
        <ul>
            <li>設定比例：${row.percent}%</li>
            <li>分類預算：${row.budgetAmount} 元</li>
            <li>警示門檻：${row.warningPercent}%，約 ${row.warningAmount} 元</li>
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
    analyzeExpense();

    const prompt = document.getElementById("aiPrompt").value;
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
