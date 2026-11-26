// Generate parity cases for suggestOutcome from frontend/src/lib/call.js.
//   node engine/fixtures/gen_js.mjs > engine/fixtures/js.json
import { suggestOutcome } from "../../frontend/src/lib/call.js";

const choices = {
  1: [null, "right_person", "switchboard", "wrong_person", "language"],
  3: [null, "call_later", "busy", "whatsapp_first"],
  5: [null, "everything_fine", "named_need"],
  7: [null, "named_time", "report_only", "vague_yes", "referred"],
};
const cases = [];
const keys = Object.keys(choices).map(Number);
const walk = (i, picked) => {
  if (i === keys.length) {
    const logs = picked.filter(([, v]) => v).map(([n, v]) => ({ stage_number: n, what_happened: v }));
    cases.push({ logs, expect: suggestOutcome(logs) });
    return;
  }
  for (const v of choices[keys[i]]) walk(i + 1, [...picked, [keys[i], v]]);
};
walk(0, []);
// String stage numbers, as older rows store them.
cases.push({ logs: [{ stage_number: "7", what_happened: "named_time" }], expect: "next_step_agreed" });
process.stdout.write(JSON.stringify({ suggest: cases }, null, 1) + "\n");
