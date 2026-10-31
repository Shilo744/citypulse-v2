"use strict";
// The ask page without a key (the keyword path): the same question to two hosts must give the same page. node scripts/parity-ask.js <baseA> <baseB>
const [A, B] = process.argv.slice(2);
const post = async (base, body) => { const r = await fetch(base + "/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, text: await r.text() }; };
const Q = [
  ["1031", "איפה המצב הכי חלש בשדרות?"], ["1031", "מה השתפר ומה הידרדר בחמש השנים האחרונות?"], ["1031", "איך מצב החיסונים לעומת יישובים דומים?"],
  ["1031", "השוואה בין שדרות, אשקלון ובאר שבע"], ["9000", "מה כדאי לעשות קודם?"], ["472", "במה המצב טוב?"], ["16", "אילו פערים יש בתוך היישוב?"], ["1031", "כמה עולה דירה בשדרות?"]
];
(async () => {
  let bad = 0;
  for (const [city, question] of Q) {
    const [a, b] = await Promise.all([post(A, { city, question }), post(B, { city, question })]);
    const ok = a.status === b.status && a.text === b.text;
    if (!ok) { bad++; console.log("DIFF", city, question, a.status, b.status, a.text.slice(0, 100), "|", b.text.slice(0, 100)); }
  }
  console.log(`ask parity: ${Q.length} questions, ${bad} differ`);
  process.exit(bad ? 1 : 0);
})();
