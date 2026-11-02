# watsonx Orchestrate with CityPulse

An **Orchestrate agent** called `CityPulse` answers questions about a locality by calling the CityPulse API as tools.
Orchestrate talks and decides; every figure still comes from the CityPulse API: `/api/ask` runs the keyword planner with `noModel: true` (no paid call of ours, nothing typed by a language model), and the agent is told to copy figures and indicator names exactly as returned.

**State on 2026-11-01 (done by hand, checked against the API):** the agent exists in a watsonx Orchestrate trial instance, two tools are imported from `https://citypulse.shilo744.workers.dev/openapi.json`, and it answers in Draft Preview. Pictures: `docs/orchestrate/`. The code that opens its chat inside the ask page is written and tested but switched off (`FEATURES.orchestrateChat` in `web/js/product/config.js`) until IBM's Embed Security is switched off for the instance (section 4).

## 1. The tools
Build, the agent, Tools, Add tool, OpenAPI. The wizard takes a **file**, not an address: save `https://citypulse.shilo744.workers.dev/openapi.json` first (the Worker fills in its own address). Two operations, no authentication, both selected:

| Name in Orchestrate | Operation |
|---|---|
| `find_a_locality_by_its_name` | `GET /api/search?q=` (`searchLocality`): the key of a locality from its name |
| `answer_a_question_about_the_public_health_of_one_locality` | `POST /api/ask` (`askAboutLocality`) with `{city, question, noModel: true}`: a page with an answer sentence and blocks, all figures final |

The file is written by `scripts/export-static.js` (`_d/openapi.json`) and served by the Worker at `/openapi.json`.
(Command-line equivalent: `orchestrate tools import -k openapi -f openapi.json`; it needs the instance URL and an API key.)

## 2. The agent
Name `CityPulse`. Description: "Answers questions about the public health of Israeli localities from official data." Model: the instance default (GPT-OSS 120B, locked by the administrator). Instructions (Hebrew, pasted as is):

```
אתה עוזר של CityPulse: מערכת נתוני בריאות הציבור הרשמיים של יישובי ישראל.
לכל שאלה על יישוב:
1. אם אינך יודע את מפתח היישוב, קרא לכלי החיפוש של יישוב לפי שם (searchLocality) וקח את המפתח של התוצאה המתאימה. אם יש כמה תוצאות מתאימות, שאל את המשתמש למי הכוונה.
2. קרא לכלי השאלה על יישוב (askAboutLocality) עם מפתח היישוב, השאלה כפי שנשאלה, ו-noModel=true. בשאלת השוואה בין יישובים, שם היישוב הנוסף נכתב בשאלה עצמה.
3. הצג את page.answer כלשונו, ואחריו את המדדים שב-page.blocks בקצרה, בשורה לכל מדד: label: ערך (מקום מתוך).
כללים:
- כל מספר חייב להופיע בתוצאת הכלי. אל תחשב, אל תעגל ואל תוסיף מספרים.
- שם כל מדד הוא השדה label, העתק אותו כמו שהוא, מילה במילה, גם כשהוא ארוך. אל תקצר ואל תנסח מחדש: "אימהות שנבדקו לאיתור דיכאון אחרי לידה" מודד כמה נבדקו, לא כמה חולות.
- אם הכלי אינו מחזיר נתון, אמור שאין נתון.
- ענה בעברית, בגוף שלישי. "דורש טיפול" הוא סימן לבדוק, לא פסק דין.
```

## 3. What was tested (Draft Preview, 2026-11-01)
- **"איפה המצב הכי חלש בשדרות?"** Step 1 calls `find_a_locality_by_its_name` with `שדרות`; step 2 calls the ask tool with `city = 1031`, `noModel = true` and the question. The answer lists the weakest figures, for example MMR/MMRV 51.9% (rank 167 of 187, national 65.8%). Compared with the response of `POST /api/ask` for the same call, every number and every indicator name matched. Pictures: `chat-answer.png`, `tool-call-1-find-locality.png`, `tool-call-2-ask.png`.
- **"איך מצב החיסונים בשדרות לעומת באר שבע?"** The comparison block came back with the three immunization figures of both towns.
- A first version of the instructions let the model shorten indicator names ("מדד דיכאון אחרי לידה" for "אימהות שנבדקו לאיתור דיכאון אחרי לידה"), which changes the meaning (how many were screened, not how many are ill). The rule "copy the label word for word" was added and the next run copied the names exactly.

## 4. The chat inside the site (written, switched off)
With `FEATURES.orchestrateChat` set to true, the ask page ends with a section that opens the chat of this agent (`web/js/product/kit/orchestrate.js`, the values in `web/js/product/config.js`). It is IBM's own embed (Deploy, Channels, Embedded agent: `window.wxOConfiguration` with `orchestrationID`, `hostURL` and the `agentId`, started by `wxoLoader.init()` from `<hostURL>/wxochat/wxoLoader.js`), shown as a panel in the page (`layout.form: "custom"`, no floating launcher).
- **Loaded only on request.** IBM's script is not part of the page. It is requested once, when a visitor presses "פתיחת השיחה עם הסוכן", and the privacy page says so. If it cannot be fetched or does not start within 15 s, the page says so in one line and the question field above keeps working.
- **Security.** IBM's embedded chat does not start while its security is on and not configured: the panel shows "Authentication Error" and the console shows `NoJwtError` (this was seen on 2026-11-01 before the switch was changed). The owner switched **Embed Security off** for this instance (Orchestrate, profile icon, Settings, Embed Security), which IBM describes as fitting public demonstrations: anyone who opens the chat can use the agent. The agent only calls the public CityPulse API, which returns figures of official open data, and it holds nothing private.
- **Limits.** The instance is a 30-day trial. When it ends the button keeps working as far as the page goes, but IBM's chat will not answer. The way to keep security on is a JWT signed for every visitor by an endpoint of the Worker (two RSA key pairs, see IBM's "Configuring security for embedded chat"); it is not built.
- **Tests.** `tests/product-orchestrate.test.mjs` (no request before the press, one script, a failure and a timeout end in the one-line message, a second visit to the page restarts the chat in the new panel).

## 5. Redo it
Create the agent from scratch, set name, description and instructions as above, add the two tools from the file, ask the two questions of section 3 in Draft Preview.
