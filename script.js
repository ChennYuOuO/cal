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

window.onload = function () {
    setToday();
    loadFromLocalStorage();
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

    saveToLocalStorage();
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

    if (unnecessaryRatio >= 40) {
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

        <strong>系統建議：</strong><br>
        1. ${advice}<br>
        2. ${extraAdvice}<br>
        3. 最大支出分類是「${escapeHTML(maxCategory)}」，可以優先檢討這類支出。
    `;

    updateBudgetBar(usedRatio);
    renderPieChart(categoryTotal, totalExpense);

    document.getElementById("warningBox").innerHTML = `
        <div class="result-box ${statusClass}">
            預警狀態：${status}<br>
            ${advice}
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
        remainingBudget
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
    remainingBudget
) {
    let expenseText = "";

    expenses.forEach(function (expense) {
        expenseText += `${expense.date}｜${expense.itemName}｜${expense.amount}元｜${expense.category}｜${expense.necessary}｜${expense.note}\n`;
    });

    const prompt = `
請用 300 字以內回答，分成 1. 消費狀況 2. 主要問題 3. 改善建議 三段即可。

月份：${month}
本月收入：${income} 元
固定支出：${fixedExpense} 元
可用消費預算：${availableBudget} 元
目前總消費：${totalExpense} 元
已使用預算比例：${usedRatio.toFixed(2)}%
目前狀態：${status}
最大支出分類：${maxCategory}
剩餘預算：${remainingBudget} 元

消費明細：
${expenseText}

請幫我完成以下分析：
1. 最大支出分類是什麼？
2. 哪些支出可能是不必要支出？
3. 我的消費習慣有什麼問題？
4. 請給我三點具體改善建議。
5. 如果我要避免下個月超支，應該怎麼設定預算？
    `;

    document.getElementById("aiPrompt").value = prompt.trim();
}

function saveToLocalStorage() {
    const data = {
        month: document.getElementById("month").value,
        income: document.getElementById("income").value,
        fixedExpense: document.getElementById("fixedExpense").value,
        safeLimit: document.getElementById("safeLimit").value,
        noticeLimit: document.getElementById("noticeLimit").value,
        warningLimit: document.getElementById("warningLimit").value,
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

    expenses = parsed.expenses || [];
}

function clearAll() {
    const confirmClear = confirm("確定要清空所有資料嗎？");

    if (!confirmClear) {
        return;
    }

    expenses = [];

    localStorage.removeItem("budgetData");

    document.getElementById("income").value = "";
    document.getElementById("fixedExpense").value = "";
    document.getElementById("availableBudget").value = "";
    document.getElementById("analysisResult").innerHTML = "";
    document.getElementById("warningBox").innerHTML = "";
    document.getElementById("aiPrompt").value = "";
    document.getElementById("geminiResult").innerHTML = "尚未產生 Gemini AI 分析結果。";

    const bar = document.getElementById("budgetBar");
    bar.style.width = "0%";
    bar.textContent = "0%";

    renderTable();
    renderPieChart({}, 0);
    setToday();
}

function hasAnalysisResult() {
    return document.getElementById("analysisResult").innerHTML.trim() !== "";
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

    resultBox.innerHTML = "Gemini AI 分析中，請稍候...";
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
            throw new Error(data.error || "Gemini API 分析失敗");
        }

        resultBox.innerHTML = formatAIText(data.result);
    } catch (error) {
        resultBox.innerHTML = `
            <div class="ai-error">
                Gemini AI 分析失敗：${escapeHTML(error.message)}<br>
                請確認：<br>
                1. 已經建立 .env 並設定 GEMINI_API_KEY。<br>
                2. 已經執行 node server.js。<br>
                3. 網頁是透過 http://localhost:3000 開啟，不是直接雙擊 HTML。<br>
                4. 電腦可以連上 Gemini API。
            </div>
        `;
    } finally {
        button.disabled = false;
        button.textContent = "使用 Gemini API 產生 AI 分析";
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
