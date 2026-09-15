"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractedItemSchema = void 0;
exports.extractSchedule = extractSchedule;
exports.refineSchedule = refineSchedule;
const zod_1 = require("zod");
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'].filter(m => m !== PRIMARY_MODEL);
const priorityEnum = zod_1.z.preprocess(val => {
    if (!val)
        return 'MEDIUM';
    const s = String(val).toUpperCase().trim();
    return ['LOW', 'MEDIUM', 'HIGH'].includes(s) ? s : 'MEDIUM';
}, zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']));
const typeEnum = zod_1.z.preprocess(val => {
    if (!val)
        return 'EVENT';
    const s = String(val).toUpperCase().trim();
    return ['TASK', 'EVENT', 'REMINDER'].includes(s) ? s : 'EVENT';
}, zod_1.z.enum(['TASK', 'EVENT', 'REMINDER']));
exports.extractedItemSchema = zod_1.z.object({
    title: zod_1.z.preprocess(val => (val && typeof val === 'string' && val.trim() ? val.trim() : 'Untitled Item'), zod_1.z.string().min(1).max(200)),
    description: zod_1.z.preprocess(val => (val == null ? null : String(val).trim() || null), zod_1.z.string().max(4000).nullable().optional()),
    startAt: zod_1.z.preprocess(val => (val == null || val === '' ? null : String(val)), zod_1.z.string().nullable().optional()),
    endAt: zod_1.z.preprocess(val => (val == null || val === '' ? null : String(val)), zod_1.z.string().nullable().optional()),
    type: typeEnum,
    category: zod_1.z.preprocess(val => (val == null ? null : String(val).trim() || null), zod_1.z.string().max(100).nullable().optional()),
    priority: priorityEnum,
    recurrence: zod_1.z.union([
        zod_1.z.string().max(500),
        zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    ]).optional().nullable(),
    reminderMinutes: zod_1.z.preprocess(val => {
        if (val == null || val === '')
            return null;
        const n = Number(val);
        return isNaN(n) || n < 0 ? null : Math.min(Math.round(n), 10080);
    }, zod_1.z.number().int().min(0).max(10080).nullable().optional()),
    confidenceScore: zod_1.z.preprocess(val => {
        if (val == null || val === '')
            return null;
        const n = Number(val);
        return isNaN(n) ? null : Math.max(0, Math.min(1, n));
    }, zod_1.z.number().min(0).max(1).nullable().optional()),
});
const responseSchema = zod_1.z.object({ items: zod_1.z.array(exports.extractedItemSchema).max(100) });
function getExtractionInstruction() {
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const year = now.getUTCFullYear();
    return `Extract calendar items from the supplied content.
Today's reference date is ${weekday}, ${todayISO} (UTC, Year ${year}). Use this current date and year when resolving relative dates such as "tomorrow", "next Monday", "Wednesday at 2 PM", or dates without an explicit year.
Return JSON only, matching this exact shape:
{"items":[{"title":"...","description":null,"startAt":"ISO-8601 with timezone or null","endAt":"ISO-8601 with timezone or null","type":"EVENT|TASK|REMINDER","category":null,"priority":"LOW|MEDIUM|HIGH","recurrence":{"frequency":"DAILY|WEEKLY|MONTHLY|YEARLY"},"reminderMinutes":null,"confidenceScore":0.95}]}
Do not invent dates or times when no schedule info is present; use null for startAt/endAt if completely unknown. For weekly classes or repeating events, include the recurrence object with frequency (DAILY, WEEKLY, MONTHLY, or YEARLY).`;
}
function jsonFromModel(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
    const trimmed = fenced.trim();
    let rawParsed;
    try {
        rawParsed = JSON.parse(trimmed);
    }
    catch {
        const startObj = trimmed.indexOf('{');
        const endObj = trimmed.lastIndexOf('}');
        const startArr = trimmed.indexOf('[');
        const endArr = trimmed.lastIndexOf(']');
        if (startArr >= 0 && (startObj < 0 || startArr < startObj) && endArr > startArr) {
            rawParsed = JSON.parse(trimmed.slice(startArr, endArr + 1));
        }
        else if (startObj >= 0 && endObj > startObj) {
            rawParsed = JSON.parse(trimmed.slice(startObj, endObj + 1));
        }
        else {
            throw new Error('Gemini did not return structured schedule data.');
        }
    }
    const normalized = Array.isArray(rawParsed) ? { items: rawParsed } : rawParsed;
    return responseSchema.parse(normalized);
}
async function callGeminiModel(modelName, key, parts, maxRetries = 2) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseMimeType: 'application/json' },
                }),
            });
            if (response.ok) {
                return response;
            }
            const errorBody = await response.text().catch(() => '');
            console.error(`[gemini:${modelName}] API returned ${response.status} (attempt ${attempt}/${maxRetries}):`, errorBody);
            if (response.status === 401 || response.status === 403) {
                throw new Error('The AI API key is invalid or expired. Please check your GEMINI_API_KEY configuration.');
            }
            if (attempt < maxRetries && (response.status === 503 || response.status === 429 || response.status >= 500)) {
                const delayMs = attempt * 1200;
                console.warn(`[gemini:${modelName}] Retrying after ${delayMs}ms due to HTTP ${response.status}...`);
                await new Promise(res => setTimeout(res, delayMs));
                continue;
            }
            const err = new Error(`AI model ${modelName} returned HTTP ${response.status}`);
            err.statusCode = response.status;
            throw err;
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (lastError.message.includes('GEMINI_API_KEY')) {
                throw lastError;
            }
            if (attempt < maxRetries) {
                await new Promise(res => setTimeout(res, attempt * 1000));
                continue;
            }
        }
    }
    throw lastError || new Error(`AI model ${modelName} call failed`);
}
async function extractSchedule(input) {
    const key = process.env.GEMINI_API_KEY;
    if (!key)
        throw new Error('AI import is not configured yet. Add GEMINI_API_KEY to the backend environment.');
    const parts = [{ text: `${getExtractionInstruction()}\n\nUser instruction: ${input.instruction || 'Extract all scheduled events and tasks.'}` }];
    if (input.text?.trim())
        parts.push({ text: `\nContent to extract:\n${input.text.trim()}` });
    if (input.file)
        parts.push({ inline_data: { mime_type: input.file.mimeType, data: input.file.base64 } });
    const candidateModels = [PRIMARY_MODEL, ...FALLBACK_MODELS];
    let response = null;
    let lastError = null;
    for (const model of candidateModels) {
        try {
            response = await callGeminiModel(model, key, parts);
            if (response && response.ok) {
                break;
            }
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`[gemini] Model ${model} failed, trying fallback if available:`, lastError.message);
            if (lastError.message.includes('GEMINI_API_KEY')) {
                throw lastError;
            }
        }
    }
    if (!response || !response.ok) {
        throw lastError || new Error('AI extraction could not be completed. Please try again.');
    }
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    if (!text.trim()) {
        console.error('[gemini] Empty response from model. Payload:', JSON.stringify(payload).slice(0, 500));
        throw new Error('The AI returned an empty response. Try providing more detailed content.');
    }
    try {
        return { parsed: jsonFromModel(text), raw: payload };
    }
    catch (parseErr) {
        console.error('[gemini] Failed to parse model output:', text.slice(0, 500), parseErr);
        throw new Error('The AI returned an unexpected format. Please try again or rephrase your input.');
    }
}
async function refineSchedule(items, command) {
    return extractSchedule({
        text: JSON.stringify({ items }),
        instruction: `Modify this existing schedule draft according to: ${command}. Keep unaffected items unchanged.`
    });
}
