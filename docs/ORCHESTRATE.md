# watsonx Orchestrate with CityPulse

Goal: an **Orchestrate agent** that answers questions about a locality by calling the CityPulse API as tools, and its **chat window embedded in the site**.
Orchestrate talks and decides; every figure still comes from the CityPulse API (`/api/ask` runs the keyword planner with `noModel: true`: no paid call of ours, nothing typed by a model).

## 1. The tools
Import `https://citypulse.shilo744.workers.dev/openapi.json` as an OpenAPI tool set (two tools):
- `searchLocality` (GET `/api/search?q=`): the key of a locality from its name.
- `askAboutLocality` (POST `/api/ask`, body `{city, question, noModel: true}`): a page with an answer sentence and blocks, all figures final.

In the Orchestrate UI: Build, create an agent, Add tool, import from an OpenAPI file or address. (The command line equivalent is `orchestrate tools import -k openapi -f openapi.json`; it needs the instance URL and an API key in the owner's own terminal.)

## 2. The agent
Name: `CityPulse`. Description: "Answers questions about the public health of Israeli localities from official data."
Instructions (paste as is):

```
אתה עוזר של CityPulse: מערכת נתוני בריאות הציבור הרשמיים של יישובי ישראל.
לכל שאלה על יישוב:
1. אם אינך יודע את מפתח היישוב, קרא לכלי searchLocality עם שם היישוב וקח את המפתח של התוצאה המתאימה. אם יש כמה תוצאות מתאימות, שאל את המשתמש למי הכוונה.
2. קרא לכלי askAboutLocality עם מפתח היישוב, השאלה כפי שנשאלה, ו-noModel=true.
3. הצג למשתמש את page.answer כלשונו, ואחריו את הבלוקים שב-page.blocks בקצרה (מדדים, מגמות, טבלאות השוואה).
כללים: כל מספר בתשובה חייב להופיע בתוצאת הכלי. אל תחשב, אל תעגל ואל תוסיף מספרים. אם הכלי אינו מחזיר נתון, אמור שאין נתון. ענה בעברית, בגוף שלישי. "דורש טיפול" הוא סימן לבדוק, לא פסק דין.
```

## 3. The chat in the site
Channels, Embedded agent (Draft mode first), copy the script, give it to the person who edits `web/js/product/pages/ask.js` (it goes next to the ask page's own field). The agent must be deployed to a live environment, and the embedded chat needs its security (JWT) set before it is opened to the public.

## What must be said truthfully in the written statement
Orchestrate is used only if these steps were really done. Until then the statement says that the ask page is our own agent (OpenRouter, Claude) and that Bob wrote the code listed in his own database.
