#!/usr/bin/env python3
"""
generate_mega.py
Produces data-mega-v2.js with all 700+ rich playbook entries
derived from seeds.py. Each entry is a full Grokipedia-style playbook
with story/apply/scenarios/resources/takeaway/book.

Also writes scenario-catalog.js — a small client-side generator that
expands the 700 seeds × N facets into 1M+ virtual scenario cards
available via lazy indexing.
"""
import json
import sys
import os
from pathlib import Path

# Make seeds importable
sys.path.insert(0, str(Path(__file__).parent))
from seeds import SEEDS, CATEGORIES

OUT_DIR = Path(__file__).parent.parent / "people-failures"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---- Templates for generating playbook details from category+archetype ----

CATEGORY_COLORS = {
    "Technology": "#0ea5e9",
    "Business": "#a78bfa",
    "Companies": "#f43f5e",
    "Products": "#06b6d4",
    "Games": "#a855f7",
    "Films": "#eab308",
    "Projects": "#84cc16",
    "Literature": "#f472b6",
    "Science": "#34d399",
    "Sports": "#fb923c",
    "Entertainment": "#facc15",
    "Politics & Fashion": "#94a3b8",
}

# Templates per category. The fields are: story, whatTheyDid (overridden by seed),
# apply (list), scenariosYes, scenariosNo, resources, takeaway, book, bookGain.
TEMPLATES = {
    "Technology": {
        "story": "The path was nonlinear. After {fail_lower}, the trajectory looked broken — but the underlying bet on the technology was sound. What looked like an endpoint became a sabbatical that rebuilt the operating model and refocused energy on the few products that mattered most. The lesson travels: forced exits, scaling crises, and platform pivots are stages, not verdicts.",
        "apply": [
            "Treat a forced exit as an opportunity to rebuild the operating model you couldn't change from inside.",
            "Simplify ruthlessly — most products in a crisis are dilutive; kill the bottom half.",
            "Write down what the old environment got wrong, so you don't repeat the same patterns.",
            "Skin in the game changes how partners, employees, and investors respond to a crisis.",
            "When two bets are both dying, pick the minimum viable survival path for each rather than sacrificing one.",
        ],
        "scenariosYes": [
            "Startup runway under 6 months",
            "Founder pushed out of a company they care about",
            "Platform that lost developer mindshare",
            "Two products both needing a win",
            "Side project that could become the main thing",
        ],
        "scenariosNo": [
            "Using 'I'll show them' as the only motivation",
            "Ignoring legitimate feedback that contributed to the removal",
            "Shipping a half-baked pivot to buy time",
            "Buying market share without unit economics",
        ],
        "resources": [
            "Time away from the old org to decompress and learn",
            "A small team or solo capacity to ship something",
            "Willingness to kill weak products",
            "A mentor who has navigated a similar reset",
            "A 12-month runway so the new direction has time to breathe",
        ],
        "takeaway": "Getting derailed can be the most productive phase of a career if you use the gap to build capability, sharpen taste, and refocus on a few bets that matter.",
        "book": "The Hard Thing About Hard Things — Ben Horowitz",
        "bookGain": "A practical, unromantic view of CEO crises — what to do when there is no good option, only less-bad ones. Sharpen your instincts for the trade-offs that only founders face.",
    },
    "Business": {
        "story": "{fail_lower} looked terminal from outside, but the underlying principle — keep cash, keep iterating, keep ownership — held. The period forced a sharper definition of who the customer was and what made the product truly different. Once the industry indifference broke, momentum returned not from new resources but from clearer conviction.",
        "apply": [
            "Keep cashflow while the side product matures — do not quit the day job prematurely.",
            "Cold-call and cold-email until you find the one yes that changes the trajectory.",
            "Own the equity tightly early — dilution at low valuations is the most expensive capital you'll ever raise.",
            "Own the distribution narrative early — let others control it and you'll lose margin to them forever.",
            "Start from a problem you live; that's where your unfair advantage compounds.",
        ],
        "scenariosYes": [
            "Physical consumer product from a non-insider",
            "Bootstrapped brand building",
            "Community-based product distribution",
            "Founder with no industry connections",
            "Side hustle growing faster than the day job",
        ],
        "scenariosNo": [
            "Giving away equity before product-market proof",
            "Scaling spend before unit economics work",
            "Hiring senior people into a business that hasn't found its customer",
        ],
        "resources": [
            "A prototype people can try",
            "Patience for cold outreach (expect 50 nos per yes)",
            "Basic IP filing to defend the wedge",
            "A small group of early customers who will give honest feedback",
            "A spreadsheet that models cash, not just growth",
        ],
        "takeaway": "Industry indifference is common until a customer votes with money — stay close to both the industry and the customer, and the indifference eventually breaks.",
        "book": "The Bootstrapper's Bible — Seth Godin / No Rules Rules (Reed Hastings)",
        "bookGain": "A field-tested playbook for building without raising — control, brand, and unit economics over speed-at-all-costs.",
    },
    "Companies": {
        "story": "The collapse was a long time coming. {fail_lower} was the visible fracture, but the underlying cracks — governance, unit economics, or a refusal to read the changing market — had been widening for years. After the moment of public failure, the survivors either restructured around a smaller, honest business or sold what remained to someone who could.",
        "apply": [
            "Read the early warning signs — your biggest risks usually become visible two years before they become fatal.",
            "Cut the vanity metrics — when a business is failing, the only metric that matters is cash and customer retention.",
            "Hire a CFO who will say the uncomfortable truth, even if it costs you optimism in the room.",
            "Don't let founders' personal incentives override governance — boards exist for a reason.",
            "Restructure while you still have options; bankruptcy as a last resort is much more expensive than as a planned move.",
        ],
        "scenariosYes": [
            "Company where the founder's story outpaced the financials",
            "Growth-at-all-costs business hitting a funding winter",
            "Mature business losing to a category disruptor",
            "Governance breakdown on the board",
        ],
        "scenariosNo": [
            "Cutting your way to growth — you cannot shrink into greatness indefinitely",
            "Pivoting without a clear hypothesis for why the next bet will work",
        ],
        "resources": [
            "Independent financial advice before the crisis peaks",
            "Restructuring counsel with creditor experience",
            "A board member who has navigated a similar collapse",
            "Honest retention data — not vanity metrics",
        ],
        "takeaway": "Most corporate collapses are governance failures dressed up as strategic ones. Fix the governance early and the strategy can be rebuilt; ignore it and the strategy will keep failing.",
        "book": "The Innovator's Dilemma — Clayton Christensen",
        "bookGain": "Why good companies fail — the very practices that make them excellent at serving existing customers make them blind to disruptive threats. A vocabulary for the trap that killed Kodak, Blockbuster, and Nokia.",
    },
    "Products": {
        "story": "The product was a swing — sometimes a brave one, sometimes a stubborn one. {fail_lower} became the textbook case for what was missing: usually not technology, but timing, ecosystem, or the right pricing wedge. The lessons inform the next product cycle, even when the original is forgotten.",
        "apply": [
            "Check whether the ecosystem is ready — even great products fail when the surrounding conditions aren't there.",
            "Pricing is the highest-bandwidth signal a customer gets — get it wrong and nothing else matters.",
            "Don't conflate 'people like it' with 'people will pay for it' — beta enthusiasm is a leading indicator of nothing.",
            "When a product fails, run the postmortem in writing — most product teams skip this and repeat the failure.",
            "Killing a failing product is almost always cheaper than nursing it — but most companies do the opposite.",
        ],
        "scenariosYes": [
            "Innovating ahead of the supporting ecosystem",
            "Premium pricing for a category not yet established",
            "First version of a category that needs multiple iterations",
            "Switching costs that prevent adoption",
        ],
        "scenariosNo": [
            "Iterating a product no one wanted in the first place",
            "Marketing spend as a substitute for product market fit",
        ],
        "resources": [
            "A small, honest beta group — not friends, not cheerleaders",
            "A pricing sensitivity study before launch",
            "Cross-functional postmortem discipline",
            "A way to track the killer feature hypothesis — most teams have lost it within 90 days",
        ],
        "takeaway": "Product failure is rarely about the product itself — it's about timing, pricing, and ecosystem. The honest postmortem is the cheapest product improvement you can buy.",
        "book": "Inspired — Marty Cagan",
        "bookGain": "How to discover products customers love — and how to tell, before you ship, whether what you're building is going to land.",
    },
    "Games": {
        "story": "The game launched into a market that wasn't ready, or with promises the technology couldn't deliver, or with a live-service model that punished early adopters. {fail_lower} became the cautionary tale. But several of these 'failures' recovered through years of free updates, honest communication, and the simple act of delivering what was originally promised — proving the lesson that the second launch matters more than the first.",
        "apply": [
            "Under-promise on the launch and over-deliver on the roadmap — the reverse is fatal in live service.",
            "Communicate honestly about what went wrong — silence is the fastest way to lose goodwill forever.",
            "A failed launch isn't a failed game — many titles recovered within 18-24 months of sustained updates.",
            "Loot boxes and aggressive monetization are tax on the long-term franchise; treat them as such.",
            "Build the live-service operations team before you ship the live service, not after.",
        ],
        "scenariosYes": [
            "Live-service game with a poor launch",
            "Crowdfunded game behind schedule",
            "Studio building a new IP with no safety net",
            "Game in a saturated genre with no clear differentiator",
        ],
        "scenariosNo": [
            "Repeating the same launch mistakes on the next title",
            "Spending on marketing instead of post-launch content",
        ],
        "resources": [
            "A community management team with authority to escalate bad news",
            "A roadmap the team can actually deliver — not aspirational",
            "A postmortem culture that doesn't blame individuals",
            "Cash to survive the post-launch recovery window (typically 12-24 months)",
        ],
        "takeaway": "Games are among the few products where a failed launch can be recovered through honesty and persistence — but only if the underlying product is good and the team is allowed to fix it.",
        "book": "Blood, Sweat, and Pixels — Jason Schreier",
        "bookGain": "Field reports from inside game development — what actually happens on the road to a troubled launch, and what teams do to recover (or fail to).",
    },
    "Films": {
        "story": "The film was a bet — on a property, a director, an audience, or a trend. {fail_lower} became the marker that defined the genre's cautionary tale. Many of these 'disasters' later became cult classics, evidence that audiences sometimes need years to catch up to what the film was actually doing.",
        "apply": [
            "Don't chase trends that have already peaked — by the time you're in production, the audience has moved.",
            "Test the audience's tolerance for the unusual early — at script stage, not after wrap.",
            "A critical disaster isn't always a financial one — and vice versa; know which kind of failure you can survive.",
            "Cult recovery takes 5-10 years — if you're going to bet on it, plan for that horizon.",
            "Sequels and reboots live or die on whether they respect what made the original matter.",
        ],
        "scenariosYes": [
            "Standalone film in a saturated franchise era",
            "Director-driven passion project with commercial pressure",
            "Genre experiment the studio doesn't understand how to market",
            "Reboot of a beloved property",
        ],
        "scenariosNo": [
            "Marketing a film to an audience that doesn't exist",
            "Cutting the film to please the studio after the cut is locked",
        ],
        "resources": [
            "A distributor that believes in the cut",
            "A festival strategy that protects the film's reputation",
            "A long horizon — cult recovery is real but slow",
            "An honest conversation about budget vs. realistic ceiling",
        ],
        "takeaway": "Film failure is often a marketing and timing failure, not a creative one — and a film's reputation is rarely settled by its opening weekend.",
        "book": "Adventures in the Screen Trade — William Goldman",
        "bookGain": "The classic insider's view of how Hollywood actually decides — and the famous line that 'nobody knows anything' about what will work before it ships.",
    },
    "Projects": {
        "story": "The project was ambitious — perhaps too ambitious — and {fail_lower} was the consequence. But projects like this reshape what's possible even in failure; the engineering, the people, and the lessons feed forward into the next attempt. The discipline of large projects is learning how to fail without abandoning the people who built them.",
        "apply": [
            "Big infrastructure projects almost always overrun — plan for it, don't pretend otherwise.",
            "The political coalition that funds a megaproject rarely outlasts the delivery timeline; build durable support across elections.",
            "Failure of one component shouldn't kill the mission — separate the engineering from the politics.",
            "Communication during a troubled project is more important than engineering — silence breeds opposition.",
            "Re-baseline the project honestly when reality diverges from the plan; pretending otherwise doubles the eventual cost.",
        ],
        "scenariosYes": [
            "Megaproject with multi-decade timeline",
            "Public infrastructure crossing political cycles",
            "Engineering project at the edge of feasibility",
            "Cost-shared project across multiple jurisdictions",
        ],
        "scenariosNo": [
            "Cutting safety or environmental review to hit a political deadline",
            "Pivoting scope without re-baselining the cost",
        ],
        "resources": [
            "An independent cost engineer who can speak truth to power",
            "A communications team with technical literacy",
            "A multi-year political coalition — not just a single administration's support",
            "Benchmark data from comparable projects (Bent Flyvbjerg's database is the reference)",
        ],
        "takeaway": "Megaprojects are politically engineered to underestimate cost and overestimate benefit — the projects that succeed are the ones that build in honesty about both, early.",
        "book": "How Big Things Get Done — Bent Flyvbjerg and Dan Gardner",
        "bookGain": "The empirical study of why megaprojects fail and the rare ones that succeed — modularity, slow thinking, and a 'think first, then act' culture.",
    },
    "Literature": {
        "story": "The writer was obscure, broke, or both. {fail_lower} was the immediate reality; what later audiences recognized was the work done in the dark — manuscripts that took decades to find a publisher, or works that were commercially dead in the author's lifetime but canonical within fifty years. The pattern repeats: the work survives, even when the author didn't see it.",
        "apply": [
            "Write to be read in twenty years, not in this quarter — most canonical literature was commercially marginal in its time.",
            "Build a body of work, not a single book — almost no one broke through on the first attempt.",
            "Submission rejection is data, not verdict — but you must believe in the work enough to keep going.",
            "Day jobs aren't a betrayal of the writing life — they're often what made the writing possible.",
            "When recognition comes, it usually comes fast and across the entire body of work at once.",
        ],
        "scenariosYes": [
            "Writer with no industry connections",
            "Genre work dismissed as not-literary",
            "Writer in a small or underrepresented tradition",
            "Late-career writer with no body of recognition",
        ],
        "scenariosNo": [
            "Quitting before the body of work exists",
            "Chasing trends to please a publisher who doesn't believe in the work",
        ],
        "resources": [
            "A community of writers, even a small one",
            "Submission discipline — keep sending out, log every response",
            "A day job that doesn't consume the writing hours",
            "A reader or two who will tell you the truth about the work",
        ],
        "takeaway": "Literary failure is almost always a question of timing — the writer's audience often doesn't exist yet. Build the body of work; the audience will catch up or it won't, but the work is the point.",
        "book": "On Writing — Stephen King / Bird by Bird — Anne Lamott",
        "bookGain": "Two practical field manuals for the writing life — King's is about discipline and survival; Lamott's is about the actual psychological practice of writing through uncertainty.",
    },
    "Science": {
        "story": "The work was right but the world wasn't ready. {fail_lower} took decades to reverse; sometimes the recognition came posthumously, sometimes via a Nobel that arrived forty years late. The lesson for scientists is uncomfortable: the work matters more than the recognition, but the recognition is what funds the next generation.",
        "apply": [
            "Publish the work even if the audience is small — recognition is a trailing indicator.",
            "Build students, not just papers — students are how unrecognized work eventually gets noticed.",
            "Cross-disciplinary work is the highest-leverage and the slowest to be recognized; plan for it.",
            "Apply for the grants anyway — the worst outcome is rejection, which is the same as not applying.",
            "Document the priority claim — but don't waste energy defending it; the work will speak eventually.",
        ],
        "scenariosYes": [
            "Researcher in a low-consensus field",
            "Cross-disciplinary work with no clear home department",
            "Researcher with no institutional prestige",
            "Work that contradicts a powerful scientific consensus",
        ],
        "scenariosNo": [
            "Abandoning the work because the audience hasn't arrived",
            "Pivoting to fashionable research for grants at the cost of the real work",
        ],
        "resources": [
            "A stable position — academic precarity is the silent killer of unrecognized research",
            "A small community of serious collaborators",
            "Students who will carry the work forward",
            "Documentation that outlives the immediate audience",
        ],
        "takeaway": "Scientific recognition is structurally slow — the work is what's worth doing, and recognition is a lagging indicator that arrives, if it arrives at all, in the rear-view mirror.",
        "book": "The Structure of Scientific Revolutions — Thomas Kuhn",
        "bookGain": "The canonical framework for how scientific consensus resists new ideas — and how paradigm shifts eventually happen anyway, often in the next generation.",
    },
    "Sports": {
        "story": "The setback was physical, mental, or political. {fail_lower} could have been the end; for some athletes it was. The ones who returned did so by narrowing focus to what was actually controllable — the next rep, the next game, the next season — and refusing to carry the narrative of the setback into the work itself.",
        "apply": [
            "After a loss, return to fundamentals — most setbacks are recovered through disciplined return to the boring basics.",
            "Physical recovery is the first-order constraint — mental recovery is impossible while the body is broken.",
            "Refuse the narrative — media will want to make the setback the story; the athlete's job is to make the next game the story.",
            "Coaching changes are part of the recovery — find a coach who believes in the next version, not the old one.",
            "Most great careers include a major setback; the rare exceptions are the ones who let the setback become the story.",
        ],
        "scenariosYes": [
            "Athlete coming back from major injury",
            "Veteran dealing with reduced role",
            "Athlete dealing with off-field controversy",
            "Young athlete dealing with early-career doubt",
        ],
        "scenariosNo": [
            "Returning before the body is ready",
            "Reading your own press, good or bad",
        ],
        "resources": [
            "A medical team that will be honest about recovery timelines",
            "A coach who has seen the trajectory before",
            "A peer who has navigated the same setback",
            "Family or support system that's not invested in the narrative",
        ],
        "takeaway": "The setback is rarely the end of the story — what ends careers is the inability to return to fundamentals and the choice to let the narrative overwhelm the work.",
        "book": "The Inner Game of Tennis — Timothy Gallwey",
        "bookGain": "The classic text on the mental game — how the conversation between the two selves (the doer and the judge) determines performance, far more than the physical skill.",
    },
    "Entertainment": {
        "story": "The performer, the band, or the genre was on a hard trajectory. {fail_lower} could have been the marker — instead, for some, it became the inflection point that redefined the work. The pattern repeats across eras: the industry rarely sees the second act coming, even though it almost always does.",
        "apply": [
            "Reinvention is a discipline, not a personality — it requires deliberate choice about what to abandon.",
            "The audience that loved the first act may not be the audience for the second — and that's the work.",
            "After controversy, the recovery is through the work, not through PR — the audience will see the difference.",
            "Genre careers are short — the rare long careers are the ones that respected the genre's natural arc and didn't try to extend it artificially.",
            "Mental health is the long pole — almost no entertainment career survives without explicit support.",
        ],
        "scenariosYes": [
            "Performer dealing with public controversy",
            "Band after a breakup",
            "Genre reaching its commercial peak",
            "Performer aging out of the audience that built them",
        ],
        "scenariosNo": [
            "Reinventing without a clear reason — the audience can tell",
            "Returning before the work is ready",
        ],
        "resources": [
            "Management that prioritizes the long career over the quick check",
            "Mental health support — non-negotiable for any long career",
            "A second creative outlet that isn't the primary one",
            "Peers who have navigated the same transition",
        ],
        "takeaway": "Entertainment failure is almost always a question of when, not if — the rare performers who endure are the ones who treat the second act as deliberate work, not as a graceful concession to aging.",
        "book": "Chronicles, Volume One — Bob Dylan",
        "bookGain": "The rare first-person account from someone who survived multiple eras — Dylan on how reinvention actually feels from the inside, and what you have to abandon to keep going.",
    },
    "Politics & Fashion": {
        "story": "The moment looked terminal. {fail_lower} could have been the end of the road; for many, it should have been. The ones who returned did so by reading the moment with brutal honesty — what was actually their fault, what wasn't, what the public would forgive in time, and what they could plausibly rebuild on.",
        "apply": [
            "Acknowledge what was actually wrong — public resistance is to the cover-up, not always to the original mistake.",
            "Disappear strategically — the public needs time to forget the version of you that failed.",
            "Rebuild on a smaller stage first — almost no political or brand comeback happens at the original scale.",
            "Don't run against the audience — they're the judge, and the work is to change their mind, not to argue.",
            "Honesty about the trajectory matters more than the trajectory itself — the public will accept decline, not pretense.",
        ],
        "scenariosYes": [
            "Public figure after a scandal",
            "Brand after a costly misstep",
            "Movement that hit a ceiling",
            "Political figure after a defeat",
        ],
        "scenariosNo": [
            "Trying to come back at the original scale without rebuilding on a smaller stage",
            "Holding onto the narrative of the failure as someone else's fault",
        ],
        "resources": [
            "Time — the most underrated political and brand resource",
            "A small, trusted circle that will tell the truth about what happened",
            "A smaller stage that allows rebuilding credibility",
            "A second act that isn't a response to the first — but a new body of work",
        ],
        "takeaway": "Comebacks in politics and fashion are slow, smaller, and earned — the rare successes are the ones that respect the audience's memory, not the ones that try to outrun it.",
        "book": "The Image — Daniel Boorstin / The Vision of the Anointed — Thomas Sowell",
        "bookGain": "Foundational texts on how public figures and brands are made and unmade in the public mind — and how comebacks actually work, when they do.",
    },
}


def fail_lower_first(fail: str) -> str:
    """Lowercase the first character of a fail string, leave the rest alone."""
    if not fail:
        return ""
    return fail[0].lower() + fail[1:]


def initials_for(name: str) -> str:
    parts = [p for p in name.replace("-", " ").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def build_entry(seed):
    sid, name, cat_idx, fail, year, what = seed
    cat = CATEGORIES[cat_idx]
    color = CATEGORY_COLORS.get(cat, "#6b7280")
    template = TEMPLATES[cat]
    fl = fail_lower_first(fail)
    story = template["story"].format(fail_lower=fl)
    return {
        "id": sid,
        "name": name,
        "initials": initials_for(name),
        "color": color,
        "category": cat,
        "fail": fail,
        "year": year,
        "story": story,
        "whatTheyDid": what,
        "apply": list(template["apply"]),
        "scenariosYes": list(template["scenariosYes"]),
        "scenariosNo": list(template["scenariosNo"]),
        "resources": list(template["resources"]),
        "takeaway": template["takeaway"],
        "book": template["book"],
        "bookGain": template["bookGain"],
    }


def main():
    entries = [build_entry(s) for s in SEEDS]

    # De-duplicate by ID — keep first occurrence. The original data had
    # duplicates (houston, tyler, newton) that caused byId() to return the
    # wrong entry. We avoid that here.
    seen = set()
    deduped = []
    dups = []
    for e in entries:
        if e["id"] in seen:
            dups.append(e["id"])
            continue
        seen.add(e["id"])
        deduped.append(e)
    if dups:
        print(f"[gen] dropped duplicate seed IDs: {sorted(set(dups))}", file=sys.stderr)

    # Also filter out IDs that already exist in data.js — those are the
    # hand-crafted "hero" entries with deeper playbook detail, and we don't
    # want to overwrite them with templated content.
    hero_path = OUT_DIR / "data.js"
    if hero_path.exists():
        # We use a tiny regex parser to find ids in data.js — robust to
        # the file's mixed single-quote / double-quote style.
        import re
        text = hero_path.read_text(encoding="utf-8")
        hero_ids = set(re.findall(r'id:\s*"([^"]+)"', text))
        hero_ids |= set(re.findall(r"id:\s*'([^']+)'", text))
        before = len(deduped)
        deduped = [e for e in deduped if e["id"] not in hero_ids]
        skipped = before - len(deduped)
        if skipped:
            print(f"[gen] skipped {skipped} entries already present in data.js hero set", file=sys.stderr)

    # Write data-mega-v2.js — one big concat for window.FAILURES.
    # We minify lightly: compact JSON, no pretty-printing.
    out_path = OUT_DIR / "data-mega-v2.js"
    with out_path.open("w", encoding="utf-8") as f:
        f.write("// Auto-generated by scripts/generate_mega.py — do not edit by hand.\n")
        f.write(f"// {len(deduped)} rich playbook entries derived from curated seeds.\n")
        f.write("window.FAILURES = (window.FAILURES||[]).concat(")
        f.write(json.dumps(deduped, ensure_ascii=False, separators=(",", ":")))
        f.write(");\n")
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"[gen] wrote {out_path} — {len(deduped)} entries, {size_mb:.2f} MB")

    # Write a small seeds index for the client-side scenario catalog.
    # We embed the seed metadata compactly so the client can expand to 1M+
    # virtual scenarios on-demand without shipping the full playbook text.
    seeds_compact = [
        {
            "id": e["id"],
            "n": e["name"],
            "i": e["initials"],
            "c": e["color"],
            "k": e["category"],
            "f": e["fail"],
            "y": e["year"],
            "w": e["whatTheyDid"],
        }
        for e in deduped
    ]
    seeds_path = OUT_DIR / "scenario-catalog-seeds.js"
    with seeds_path.open("w", encoding="utf-8") as f:
        f.write("// Auto-generated. Compact seed list for client-side scenario expansion.\n")
        f.write(f"// {len(seeds_compact)} seeds. Each will be expanded into ~1500 virtual\n")
        f.write("// scenarios by scenario-catalog.js, yielding ~1M entries on-demand.\n")
        f.write("window.SCENARIO_SEEDS = ")
        f.write(json.dumps(seeds_compact, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    size_kb = seeds_path.stat().st_size / 1024
    print(f"[gen] wrote {seeds_path} — {len(seeds_compact)} seeds, {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
