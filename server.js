const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

loadDotEnv();

function loadDotEnv() {
    const envPath = path.join(ROOT, ".env");
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const equalIndex = trimmed.indexOf("=");
        if (equalIndex === -1) continue;

        const key = trimmed.slice(0, equalIndex).trim();
        let value = trimmed.slice(equalIndex + 1).trim();
        value = value.replace(/^['"]|['"]$/g, "");

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    res.end(JSON.stringify(data));
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 1024 * 1024) {
                req.destroy();
                reject(new Error("請求內容太大"));
            }
        });

        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}

async function handleGeminiAnalyze(req, res) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

        if (!apiKey) {
            return sendJson(res, 500, {
                error: "尚未設定 GEMINI_API_KEY，請複製 .env.example 為 .env 並填入 Gemini API Key。"
            });
        }

        const rawBody = await readRequestBody(req);
        let input;

        try {
            input = JSON.parse(rawBody || "{}");
        } catch (error) {
            return sendJson(res, 400, { error: "前端送出的資料不是正確 JSON。" });
        }

        const prompt = String(input.prompt || "").trim();

        if (!prompt) {
            return sendJson(res, 400, { error: "沒有收到要分析的記帳資料。" });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

        const geminiResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [
                        {
                            text: "你是個人記帳與消費分析助理。請使用繁體中文回答。請控制在 150 字以內。不要開頭寒暄。不要解釋太多。請只分成三點回答：1. 消費狀況2. 主要問題3. 改善建議"
                        }
                    ]
                },
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 2048
                }
            })
        });

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
            const message = data?.error?.message || "Gemini API 呼叫失敗。";
            return sendJson(res, geminiResponse.status, { error: message });
        }

        const text = data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("\n")
            .trim();

        if (!text) {
            return sendJson(res, 502, {
                error: "Gemini API 沒有回傳文字內容。",
                raw: data
            });
        }

        return sendJson(res, 200, { result: text });
    } catch (error) {
        return sendJson(res, 500, { error: error.message || "伺服器發生未知錯誤。" });
    }
}

function serveStaticFile(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/") {
        pathname = "/index.html";
    }

    const filePath = path.normalize(path.join(ROOT, pathname));

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("找不到檔案");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml"
        };

        res.writeHead(200, {
            "Content-Type": mimeTypes[ext] || "application/octet-stream"
        });
        res.end(content);
    });
}

const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/analyze") {
        handleGeminiAnalyze(req, res);
        return;
    }

    if (req.method === "GET") {
        serveStaticFile(req, res);
        return;
    }

    sendJson(res, 405, { error: "不支援的請求方法。" });
});

server.listen(PORT, () => {
    console.log(`個人記帳與消費分析系統已啟動：http://localhost:${PORT}`);
});
