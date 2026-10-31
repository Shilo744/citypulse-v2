// An explained word: underlined text that opens the definition in a native <dialog>. Not a capsule, not a link.
import { h } from "../../ui.js";
import { openDialog } from "./base.js";
import { glossaryTerm, glossaryHref } from "./glossary.js";

export function openTerm(termId, opener) {
  const t = glossaryTerm(termId);
  if (!t) return null;
  const toGlossary = h("a.n-kit-link", { href: glossaryHref(termId) }, "לכל המונחים");
  return openDialog({
    title: t.term,
    body: [h("p.n-kit-def", t.short), t.long ? h("p.n-kit-def-long", t.long) : null],
    foot: toGlossary,
    opener
  });
}

// termButton("concern", "דורשים טיפול"): the label is the word as the sentence uses it (inflected); the dialog always shows the glossary term
export function termButton(termId, label) {
  const t = glossaryTerm(termId);
  if (!t) return h("span", label == null ? termId : label);
  const btn = h("button.n-kit-term", { type: "button", "aria-haspopup": "dialog" }, label == null ? t.term : label);
  btn.addEventListener("click", () => openTerm(termId, btn));
  return btn;
}
