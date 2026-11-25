/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const ALIASES = {
  prospect_name: ["prospect_name", "name", "prospect", "contact", "contact name", "person"],
  prospect_role: ["prospect_role", "role", "title", "designation", "position"],
  company_name: ["company_name", "company", "organisation", "organization", "firm"],
  company_kind: ["company_kind", "kind", "type", "company type", "industry"],
  phone: ["phone", "mobile", "number", "phone number", "contact number"],
};

/** CSV text -> prospects. Needs at least a name and a company column. */
export function prospectsFromCsv(text) {
  const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!header) throw new Error("The file is empty.");
  const norm = header.map((h) => h.trim().toLowerCase());
  const col = Object.fromEntries(
    Object.entries(ALIASES).map(([key, names]) => [key, norm.findIndex((h) => names.includes(h))])
  );
  if (col.prospect_name < 0 || col.company_name < 0) {
    throw new Error("Add a header row with at least “name” and “company” columns.");
  }
  const get = (r, k) => (col[k] >= 0 ? (r[col[k]] || "").trim() : "");
  return rows
    .map((r) => ({
      prospect_name: get(r, "prospect_name").slice(0, 120),
      prospect_role: get(r, "prospect_role").slice(0, 120),
      company_name: get(r, "company_name").slice(0, 160),
      company_kind: get(r, "company_kind").slice(0, 80) || "mid-size private company",
      phone: get(r, "phone").slice(0, 40),
    }))
    .filter((p) => p.prospect_name && p.company_name);
}

export const SAMPLE_CSV =
  "name,role,company,kind,phone\n" +
  "Ramesh Varma,Managing Director,Sri Balaji Precision,mid-size private manufacturer,+91 98xxxxxx01\n" +
  "Dev ji,Technical Services Director,Kalpana Chem Supplies,mid-size private company,+91 98xxxxxx02\n";
