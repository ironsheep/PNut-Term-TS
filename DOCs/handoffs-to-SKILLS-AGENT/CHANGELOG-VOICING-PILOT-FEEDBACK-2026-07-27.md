# Pilot feedback — changelog voicing guide (pnut-term-ts, class 2)

**From** pnut-term-ts · **Date** 2026-07-27 · **Pilot** 1 of 3 · **Guide draft read:**
`DOCs/process/changelog-voicing.md` (pilot copy, unedited as instructed)

Findings, not edits. Ordered by consequence: the two that can break a release first.

**Context for weighing these:** this project hit the pilot at an unusually informative
moment — mid-1.0.0 release preparation, with all seven release gates closed and three
platforms certified. So §3 (the first-release boundary) was exercised for real, not
rehearsed, and it was exercised by a project whose release pipeline is automated.

---

## 1. BLOCKER — the mandated heading form breaks an automated release pipeline

**Severity: release-breaking. The guide predicted this class of problem (§7, and the pilot
brief) but the prediction needs to become a procedural step, not a note.**

`.github/workflows/release.yml` builds the GitHub release body by extracting the section
for the version being tagged:

```bash
CHANGELOG_CONTENT=$(awk "/^## \[${VERSION}\]/{flag=1; next} /^## \[/{flag=0} flag" CHANGELOG.md ...)
```

That matches Keep a Changelog's `## [1.0.0] - 2026-07-27`. §1.5 mandates
`## v1.0.0 (2026-07-27)`. Adopt the guide without patching the workflow and **every
release body silently comes out empty** — the tag succeeds, the packages upload, and the
release notes are blank. Nothing fails loudly.

**What the guide should say.** §7 currently notes that some projects parse the heading and
says "do not vary it". That is backwards for an adopting project: the guide is asking them
to vary it *once*, from whatever they used before. Suggested rule:

> **Before changing the heading form, grep the repo for anything that reads `CHANGELOG.md`
> — release workflows, packaging scripts, version-lock checks — and patch the reader in the
> same commit or earlier. Verify by dry-run before the changelog is touched.**

That belongs in §3 as a numbered step (it fires exactly once, at adoption) and in §7 as a
standing check.

## 2. BLOCKER — §3.1's no-bullets rule collides with bullet-scraping tooling

**Severity: release-breaking for the initial release specifically. The guide is silent on
this; we had to invent an answer.**

The same workflow derives its headline summary from the first bullet of the section:

```bash
SUMMARY_LINE=$(echo "${CHANGELOG_CONTENT}" | grep -m1 '^\- ' | sed 's/^- //' ...)
```

§3.1 requires the initial-release entry to be **a paragraph with no bullets and no
sections**. So on the one release where the changelog matters most to a new audience, the
summary line falls back to a generic default — here, literally
`"Bug fixes and improvements"` on a 1.0.0 announcement.

This is not a niche pipeline shape. "First bullet = summary" is a common convention
precisely *because* Keep a Changelog guarantees bullets exist.

**What we chose:** made the extractor prefer the theme line (§1.5's mandated single
sentence under the heading) and fall back to the first bullet only when no theme line is
present. That works for both modes and is what we would recommend centrally.

**What the guide should say:** §1.5 already mandates a theme line on every entry in every
mode and class. Make it explicit that **the theme line is the machine-readable summary** —
tooling should read it, not scrape bullets. One sentence in §1.5 fixes this for every
adopting project, and it makes the theme line earn its mandate.

## 3. §3.1's worked example is plausible-but-wrong — and it is the highest-risk example in the guide

The pilot brief asked whether any invented class-2 example reads wrong. §5/§6's are fine —
generic enough to be harmless. **§3.1's is the problem, and it is about this project:**

> "A cross-platform debug terminal for the Parallax Propeller 2 — serial download, the full
> set of P2 debug display windows, and the single-step debugger, on Windows, macOS, and
> Linux. **Replaces the Windows-only original with byte-level behavioral parity.**"

The first sentence is accurate and genuinely useful as a shape. The second sentence is
wrong twice:

1. **"byte-level behavioral parity" overclaims.** Our parity claim is *functional parity
   with PNut v55 for the DEBUG display language only*. The terminal half has **no PNut
   counterpart**, so PNut cannot be cited for or against it. A blanket "byte-level"
   parity claim is one we would have to defend and could not.
2. **"Replaces the Windows-only original" is the wrong lineage.** There are three tools,
   not two: PNut is editor + compiler + downloader + debug windows and **has no terminal**;
   Parallax Serial Terminal (PST) is a terminal with a downloader and **has no debug
   windows**. This product is the *runtime halves of both, unified in one executable*, plus
   automatic logging that neither has. "Replaces the original" describes a product that
   does not exist.

**Why this one matters more than the others:** §3.1 is the template for the single
most-read entry a project will ever write, produced once, under release pressure, by
someone reaching for the nearest model. An example that overclaims parity is worse than a
bland one — it teaches a project to make a claim it cannot support.

**Suggested fix:** keep sentence 1, drop sentence 2, and replace the "at most a line on
what makes it distinctive" guidance with a caution: *the distinctive line is the easiest
place in a changelog to overclaim; state only what the project can defend.* If a real
example is wanted, ours is: *"the runtime halves of PNut and PST unified in one
executable, plus the automatic logging neither has."*

## 4. Missing rule — the transition changes what SHIPS, and the guide does not say so

Our packaging scripts (`create-{windows,linux,macos}-package*.sh`) copy `CHANGELOG.md`
into every user-installed package. After §3's archive step, the shipped changelog contains
**one paragraph**, and the entire development history stays in-repo.

That is almost certainly intended — the archive is for us, not the user — but the guide
never states it, and an adopting project discovers it only if it happens to grep its
packaging scripts. For a class-2 project the guide *explicitly* says "distribution is
user-visible" (§5), so the interaction deserves a sentence.

**What we chose:** ship only the new `CHANGELOG.md`; do not add the archive to packages.
Rationale: 1.0.0 is the first public release, so no installing user has any prior history
to want. If a project is adopting the guide *after* having shipped publicly, the answer
might differ — which is itself worth a line in §3.

**Suggested rule for §3:** *"Check whether the changelog is copied into a distributed
artifact. If it is, decide deliberately whether the archive ships with it; the default is
no."*

## 5. Verbosity budget — ~40 words is right, with one caveat

The budget is well-judged for the common case, and §2.3's good/bad pair (drawn from our
v0.11.11 entry) reads exactly right — the "AVOID" version is recognisably the failure mode
we actually have.

**The caveat: ~40 words cannot carry a finding whose value IS the disproof.** Our best
development entries in this cycle were ones where the finding was *"the obvious explanation
is wrong, and here is what it actually was"* — those need the wrong hypothesis named, or a
future session re-runs it. Example, compressed as far as it goes and still ~55 words:

> **Console noise on Linux was three separate causes, not one.** Two were ours (an unset
> program name, ungated save diagnostics); one was Chromium's GPU process. Disabling audio
> would have silenced the fourth — but the PST Bell plays a WAV, so that "fix" would have
> broken the terminal bell.

Cutting that to 40 loses the trap, which is the only part a future session needs.

**Suggested refinement:** keep ~40 as the target, and add: *"a finding that records a
rejected explanation may run longer — the rejected branch is the value. Do not pad, but do
not cut the disproof."*

## 6. Class-2 vocabulary — holds, with one gap

"Lead with the flag/setting/command, else a short bold prose label" held for nearly every
real entry we wrote this cycle: `--diag-serial`, `Window > Show Log / Hide Log`,
`**Window save**`, `**Display names**`.

**The gap: changes to what the program PRINTS have no touchable noun.** A whole release of
ours (v0.11.11/0.11.12) was about console output — the user's entire interaction with it is
reading their terminal. `**Console output**:` works as a prose label but is doing more work
than §5 anticipates. Worth naming explicitly in the class-2 touchable-surface list, which
currently says "diagnostic and console output" but gives no lead-in form for it.

## 6a. §3 as executed — what the five steps actually cost, and two things they miss

Added after doing the transition (the findings above were written before it). We ran §3
end to end on 2026-07-27: mined, archived to `DOCs/history/CHANGELOG-0.x-development.md`,
headed it, restarted `CHANGELOG.md` at `## v1.0.0 (2026-07-27)`, and decided the shipping
question. **The order is right and the steps are complete apart from the two below.** The
whole transition took well under an hour, most of it mining.

**a. Archiving silently breaks re-running a release pipeline on an old tag.** The guide has
us patch the changelog *reader* (finding 1) so it accepts both heading forms — but that is
about form, and the real change is that the **content moved**. Our workflow rebuilds the
GitHub release body from `CHANGELOG.md` at whatever tag it runs on; after the archive step,
every pre-1.0.0 tag extracts to nothing. Already-published releases keep their bodies, so
the blast radius is small — but it is another silent one, and a project that re-runs
releases would want to know before archiving, not after. Worth one line in §3 step 2:
*archiving moves the content, not just the file; anything that regenerates release notes
for an older version will come back empty.*

**b. "Head the archive" needs to say what the header must accomplish.** §3 step 3 lists the
four facts (pre-release, frozen at version, not governed, not maintained) and gives the
reason — a future session will otherwise "fix" it. That reason is the operative part, and
it implies a fifth fact worth naming: **why the entries look the way they do.** Ours record
root causes, rejected approaches, and parity findings — all of which read as violations
under released-mode rules. Saying "its audience was us, so it records what a user-facing
changelog excludes" is what actually stops the helpful cleanup; "frozen" alone reads as a
rule to be argued with.

**c. Mining: the log was the wrong shape for the job, and that is fine.** 1,826 lines
across 60-odd versions, and the initial-release paragraph came almost entirely from four
places — the very first entry (v0.9.0, the original scope statement), the headless-mode
entry, and two identity corrections. Everything between was churn by design. Worth telling
adopting projects: **mining is not summarizing — expect to use a very small fraction of the
log, and expect the useful parts to cluster at the beginning and at capability additions,
not at the fixes.** That reframing would have saved us a full read.

**d. Confirming finding 3 from the other side.** Having now written the real paragraph, the
example's failure is sharper than we described. We could not use the §3.1 second sentence
at all, and the replacement is not a tightened version of it — it is a different claim. The
guide's caution should be that *the distinctive line usually has to be derived from the
product, not adapted from an example*, because the failure mode is specifically reaching
for the nearest model.

## 7. Smaller notes

- **§1.7 (never-shipped versions) is load-bearing for a 0.x project and easy to miss.** We
  tagged eleven 0.11.x builds in three days; several exist only as hardware-test artifacts.
  Under §3 they vanish into the archive, which is right — but a project *not* crossing the
  boundary would need §1.7 applied to its own recent history. Consider cross-referencing
  §1.7 from §2.
- **§2 and §3 interact in a way worth stating:** if the transition fires during release
  prep, the last few development entries are written under §2 and then archived days later.
  We nearly skipped writing them properly on the reasoning that they were about to be
  archived. §2.4 says the log is "worth writing well" — worth restating in §3 as *write the
  last entries normally; the archive is a record of how the work went, not a draft.*
- **No local `changelog-style-guide.md` existed**, so §7's deletion step was a no-op here.
  Cannot report on it.

---

## Answering the brief's five questions directly

| # | Question | Answer |
|---|---|---|
| 1 | Rules that did not fit | §1.5's heading form vs. an automated pipeline (finding 1) — not a bad rule, a missing adoption step. |
| 2 | Missing rules | Theme line as the machine-readable summary (2); changelog-in-shipped-artifact (4); rejected-explanation length allowance (5). |
| 3 | Is ~40 words right? | Yes, with the disproof caveat (5). |
| 4 | Class-2 vocabulary | Holds; gap for "what the program prints" (6). |
| 5 | The transition (§3) | Run end to end; see finding 6a. Five-step order is correct **provided a step 0 is added**: patch anything that parses the changelog first. Two gaps: archiving moves the *content*, so old-tag release-note regeneration comes back empty; and the archive header needs to say *why the entries look the way they do*, not just "frozen". Mining produced a usable paragraph — see finding 3 for what we had to change versus the example. |

**Net:** the guide is close. The two blockers are both *tooling-interaction* gaps rather
than voice problems, and both are fixed by one added step and one added sentence. The voice
guidance itself we would adopt as-is.
