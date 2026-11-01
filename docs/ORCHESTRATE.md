# watsonx Orchestrate with CityPulse

An **Orchestrate agent** called `CityPulse` answers questions about a locality by calling the CityPulse API as tools.
Orchestrate talks and decides; every figure still comes from the CityPulse API: `/api/ask` runs the keyword planner with `noModel: true` (no paid call of ours, nothing typed by a language model), and the agent is told to copy figures and indicator names exactly as returned.

**State on 2026-11-01 (done by hand, checked against the API):** the agent exists in a watsonx Orchestrate trial instance, two tools are imported from `https://citypulse.shilo744.workers.dev/openapi.json`, and it answers in Draft Preview. Pictures: `docs/orchestrate/`. It is **not** deployed to a public channel and **not** embedded in the site (section 4).

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

## 4. Embedding the chat in the site (not done, and why)
Deploy, Channels, Embedded agent gives a script (`window.wxOConfiguration` with `orchestrationID`, `hostURL`, `agentId`, loaded from the instance). According to IBM's documentation the embedded chat does not start until its **security** is configured (two RSA key pairs and a JWT signed for every visitor by a server-side endpoint), and switching security off lets anyone who finds the page use the instance. That means a signing endpoint on the Worker with a private key kept as a secret, a deployed (live) agent, and a trial that ends after 30 days, after which the widget would stop working on a public page. Until the team decides to take that on, the site keeps its own ask page and Orchestrate is another way in through the open API.

## 5. Redo it
Create the agent from scratch, set name, description and instructions as above, add the two tools from the file, ask the two questions of section 3 in Draft Preview.
