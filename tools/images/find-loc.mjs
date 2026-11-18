#!/usr/bin/env node
/**
 * tools/images/find-loc.mjs
 *
 * Finds candidate pictures on loc.gov and prints only those whose own item record carries an
 * explicit rights statement we accept ("No known restrictions on publication" or a public domain /
 * U.S. Government work statement). Items with "Rights status not evaluated", a named rights
 * holder, or no statement are listed as rejected and never used.
 *
 *   node tools/images/find-loc.mjs "statue of liberty" [--n=8] [--fa=original_format:photo,+print,+drawing]
 *
 * Developer tool: it only reads from loc.gov (slowly, to respect its rate limits) and writes nothing.
 */
const UA = "LanguageLabResearch/1.0 (practice tool; research for public-domain pictures)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function getJson(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 || res.status >= 500) {
      await sleep(5000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    await sleep(1200);
    return res.json();
  }
  throw new Error(`gave up on ${url}`);
}
/** True for the rights statements we accept. Everything else is rejected. */
export function acceptableRights(text) {
  if (typeof text !== "string") return false;
  if (/not evaluated|copyright|rights holder|permission|reproduction restrict|may be restricted|all rights reserved/i.test(text.replace(/Copyright and Other Restrictions/gi, ""))) return false;
  return /no know?n? (copyright )?restrictions? on publication|public domain|u\.s\. government (work|publication)/i.test(text);
}
const args = process.argv.slice(2);
const query = args.find((a) => !a.startsWith("--"));
if (query !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(args.find((a) => a.startsWith("--n="))?.slice(4) ?? 8);
  const fa = args.find((a) => a.startsWith("--fa="))?.slice(5);
  const base = args.find((a) => a.startsWith("--base="))?.slice(7) ?? "https://www.loc.gov/photos/";
  const url = `${base}?q=${encodeURIComponent(query)}&fo=json&c=${n}${fa ? `&fa=${fa}` : ""}`;
  const found = await getJson(url);
  for (const r of found.results ?? []) {
    const id = String(r.id).replace(/^https?:\/\/www\.loc\.gov\/item\//, "").replace(/\/$/, "");
    if (!/^\d+$/.test(id)) continue;
    let item;
    try {
      item = (await getJson(`https://www.loc.gov/item/${id}/?fo=json`)).item;
    } catch (e) {
      console.log(`?  ${id} ${e.message}`);
      continue;
    }
    const rights = item.rights_advisory ?? item.rights_information ?? "";
    const ok = acceptableRights(rights);
    console.log(`${ok ? "OK" : "--"} ${id} | ${String(item.title).slice(0, 70)} | ${item.created_published_date ?? item.date ?? ""} | ${String(rights).replace(/\s+/g, " ").slice(0, 110)}`);
  }
}
