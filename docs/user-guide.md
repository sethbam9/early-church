# Early Christianity Atlas — User Guide

A practical guide to navigating and researching with the Early Christianity Atlas. Covers the three main views and walks through common research workflows with concrete examples.

---

## Overview

The Atlas is organized around three views, each suited to a different kind of exploration:

| View | Best for |
|------|----------|
| **Map** | Watching Christianity spread across geography over time; exploring where a person, group, or doctrine was present |
| **Graph** | Understanding relationships and connections between people, works, events, and ideas; finding paths between figures |
| **Wiki** | Deep-diving into a single entity; auditing evidence and sources; reading editorial essays |

---

## Getting Around

### Selecting an Entity

Click any **place marker** on the map, **node** on the graph, or **entity name** in the wiki list to open its detail panel on the right (or center on the wiki). The panel shows tabs for Info, Timeline, related entities, footprints, notes, and more.

### Navigating Between Entities

From any entity detail panel you can:
- Click any linked entity name to navigate to it (pushes the current entity onto the **back stack**).
- Use **← Back** to return to the previous entity.
- Use **✕** to exit to the list view.
- Use the **CrossPageNav** icons in the entity header to jump to the same entity on a different page.

### Global Search

The search bar at the top of the left panel (on Map and Graph) or the wiki sidebar opens a **Global Search Overlay**. Type at least two characters to see results across all entity types. Use **↑/↓** to navigate and **Enter** (or click) to select.

**Tip:** Press **/** from anywhere in the app to instantly focus the search bar in the top navigation.

### Dark Mode

Click the **Moon** icon at the far right of the navigation bar to toggle dark mode. Click the **Sun** icon to return to light mode.

---

## Use Cases

---

### 1. See where a doctrine was present on the map

**Example:** "Where was infant baptism attested or affirmed, and where was it condemned?"

1. Go to **Map**.
2. Open the **Global Search Overlay** (search bar at top of left panel, or press `/`).
3. Type `infant baptism` (or the proposition label). Click the matching proposition result.
4. The map immediately recolors all place markers by stance:
   - **Green** — affirms the proposition.
   - **Red** — opposes/condemns it.
   - **Yellow** — mixed or neutral evidence.
5. The left panel **context banner** shows the total place count plus affirm / condemn / mixed tallies.
6. A **stance legend** appears at the bottom of the left panel.
7. Click any marker to open its detail and see which works or persons at that place affirmed or opposed the doctrine.
8. Use the **decade slider** to watch the stance distribution change across centuries.

**Tip:** If you want to filter the map to show *only* the places connected to a specific proposition, click the proposition in the right panel's Propositions tab, then toggle **"Filter map to this proposition"** to "On."

---

### 2. Find the path from Paul to Origen

**Example:** "How is Paul of Tarsus connected to Origen of Alexandria through the relationship graph?"

1. Go to **Graph**.
2. In the left panel, open the **Path Finder** section (below the filter chips).
3. Click the **Start** field and type `Paul`. Select "Paul of Tarsus" from the dropdown.
4. Click the **End** field and type `Origen`. Select "Origen of Alexandria."
5. Click **Find Path**.
6. The graph highlights the shortest route in **green**: all path nodes stay fully visible, non-path nodes and edges are dimmed.
7. A summary below the inputs shows the hop count and intermediary names.
8. Click any node along the path to open its detail panel and see what relationship it has to its neighbors.

**Tip:** Use the **⇄ swap** button to reverse start and end. Use "→ Start" / "→ End" when you've already clicked a node you want to use.

---

### 3. Track the spread of Christianity decade by decade

**Example:** "How did Christian communities spread from Jerusalem through the Mediterranean from AD 33 to AD 200?"

1. Go to **Map**.
2. Make sure **Include earlier decades** is toggled **on** (this shows cumulative presence).
3. Set the **decade slider** to AD 33 (the earliest decade).
4. Turn on **Christian places only** to filter out non-Christian locations.
5. Press **▶ Play** to animate through the decades. The map fills in as new cities acquire Christian presence.
6. Pause at any decade to examine the state. The place count updates in the left panel header.
7. Adjust **Playback speed** (1×, 2×, 4×) to control the animation rate.
8. Click any newly-appeared city to see the earliest attestation for that place, which sources document it, and which groups were present.

**Tip:** Filter to **attested** presence only using the presence chips to show only the places with the strongest documentary support.

---

### 4. Explore everything associated with a specific person

**Example:** "What do we know about Irenaeus of Lyon — where he lived, what he wrote, what he believed, and who his teachers were?"

1. Go to **Wiki**.
2. Make sure the left tabs show **People** (click the People tab).
3. Search for `Irenaeus` in the filter box. Click his name to open his detail.
4. **Info tab** — shows his dates, kind (bishop/theologian), and any direct scalar claims.
5. **Timeline tab** — shows all dated claims grouped by decade: when he was bishop of Lyon, when he wrote *Against Heresies*, when he was born/died.
6. **Works tab** — lists his authored works. Click any work to see its sources and the propositions it affirms or opposes.
7. **People tab** — lists his teacher/student relationships (e.g., Polycarp as teacher).
8. **Places tab** — lists all locations associated with him, derived from his bishop_of claim and authored work geography.
9. **Beliefs tab** — lists all propositions he affirmed or opposed, with expandable evidence passages.
10. Use **CrossPageNav** (Map icon) to jump to the Map and see all his locations highlighted on the map.

---

### 5. Research a historical event and its participants

**Example:** "Who participated in the Last Supper, what are the primary sources, and what claims are attached to it?"

1. Go to **Wiki**.
2. Click the **Events** tab in the left panel.
3. Search for `last supper`. Click the event to open it.
4. **Info tab** — shows the event type, date range, and any notes.
5. **People tab** — lists all participants (Jesus, the Apostles) with the `participant_in` predicate.
6. **Places tab** — shows the derived location (Jerusalem) and the certainty.
7. **Beliefs tab** — shows any propositions linked to this event.
8. Click **← back** or switch to **Claims view** (toggle at top right) to see the raw claim list with evidence passages (e.g., Luke 22:7–23, 1 Cor 11:23–26).

---

### 6. Compare which groups were dominant in a city at a given time

**Example:** "Who controlled Antioch in AD 100, and what Christian groups were present?"

1. Go to **Map**.
2. Set the decade slider to **AD 100**.
3. Click the **Antioch** marker on the map (or search for it).
4. The right panel opens on the **Place** detail for Antioch.
5. **Info tab** — shows the dominant polity group (with sword icon) and presence status for this decade.
6. **Timeline tab** — shows the full decade-by-decade history of presence status and which groups were active.
7. **Groups tab** — lists all groups with a presence claim for Antioch, with predicates and certainty.
8. **People tab** — lists all persons with a footprint at Antioch and the claim that puts them there.

---

### 7. Audit the evidence behind a claim

**Example:** "How well-sourced is the claim that Peter was martyred in Rome?"

1. Go to **Wiki**.
2. Click the **Events** tab and select **Peter's Martyrdom**.
3. Toggle to **Claims view** using the Relations/Claims toggle in the top bar.
4. Find the `event_occurs_at` claim linking to Rome.
5. Click the claim row to expand it and see the **EvidenceCard**:
   - Which passages support it (e.g., Eusebius, *Ecclesiastical History* 2.25).
   - The evidence **role** (supports/contextualizes), **weight**, and any editorial notes.
   - A link to the source record.
6. Click the passage reference to jump to the source in the Sources tab.
7. Alternatively, switch to **Audit mode** (toggle in left panel), filter by entity type "event" and predicate containing "occurs_at" to see the review status (approved/pending/disputed) for this and similar claims.

---

### 8. Read an essay and follow its entity links

**Example:** "Read the essay on Apostolic Succession and explore the people and works it references."

1. Go to **Wiki**.
2. Click the **Essays** tab in the left panel. Select *Apostolic Succession and Oral Tradition*.
3. The **Content** tab renders the full essay on a clean white background. All `[[entity]]` links are interactive — hover to see a tooltip, click to navigate to that entity's detail.
4. Switch to the **Entities** tab to see every referenced entity grouped by kind (People, Works, Places, etc.). Hover any item for a quick preview card.
5. Use **← Back** to return to the essay after exploring an entity.
6. Click **Open in map** in the top bar to move to the Map page with the essay open in the right panel, so you can simultaneously read the essay and pan to the places it discusses.

---

### 9. Explore degrees of separation in the relationship network

**Example:** "How many hops away is Tertullian from everyone else in the network?"

1. Go to **Graph**.
2. In the left panel, find the **Degrees of Separation** section.
3. Type `Tertullian` in the source picker and select him.
4. The graph immediately recolors: Tertullian is **green** (0 hops), directly connected nodes shade yellow, further nodes fade through orange to red, and unreachable nodes go dark grey.
5. Hop numbers appear inside each node.
6. The **Degrees Histogram** below the picker shows a bar chart of how many nodes sit at each hop distance.
7. Click any node to open its detail and see which specific relationships connect it back to Tertullian.

---

### 10. Filter the map to show only places connected to a work

**Example:** "Where was Paul's Letter to the Romans written, and where was it addressed?"

1. Go to **Map** (or start from Wiki, open the work, then use CrossPageNav to Map).
2. Search for `Romans` and select the work.
3. In the right panel, toggle **"Filter map to this work"** to **On**.
4. The map dims all unrelated places; the places connected to Romans (written-at and addressed-to) are highlighted with amber rings.
5. The **Show arcs** toggle (left panel) draws curved lines between the written-at location and the addressed-to places.
6. Click any highlighted place to see the full place detail.

---

### 11. Understand place marker shapes on the map

Each place on the map uses a distinct icon shape indicating its geographic kind:

| Icon | Place kind |
|------|-----------|
| Building (Building2) | City |
| Mountain | Site / archaeological site |
| Church building | Monastery / religious house |
| Temple columns (Landmark) | Region / administrative area |
| Location pin (MapPinned) | Province |
| Route lines | Trade route / road |

Click the **Legend** button at the bottom-left of the map to see the full key. The same icons appear in the right panel entity lists and wiki place list.

---

## Tips & Shortcuts

- **"/" key**: Press `/` from anywhere (when not typing) to focus the main search bar in the navigation.
- **Keyboard search**: Arrow keys navigate the search dropdown; Enter selects.
- **Back-stack**: Every entity click pushes to history. Use ← Back freely; ✕ exits to the top-level list.
- **Cross-page continuity**: The selection state persists when switching pages. Click the map icon on a person in the wiki and the map will be centered on their footprint.
- **Scroll preservation**: When you read an essay and navigate to an entity then return, the essay resumes at the same scroll position.
- **Copy entity ID**: Every entity detail panel has a small clipboard button in the back bar. Click it to copy the raw entity ID for use in TSV editing or data workflows.
- **Entity kind color bar**: Notice the thin colored bar at the top of each entity detail panel — its color indicates the entity kind (amber = person, blue = work, purple = proposition, etc.).
- **Place kind in wiki list**: When you browse the Places tab in the wiki, each entry shows the specific place-kind icon (building, mountain, church, etc.) matching its map marker.
- **Graph node counts**: The left panel filter rows in Graph show how many nodes of each type are currently visible, making it easy to understand the graph composition at a glance.
- **Dark mode**: Toggle between light and dark themes using the Moon/Sun button in the top-right of the navigation bar.
- **Presence chips**: Click multiple presence filter chips to focus on specific attestation quality (e.g., show only "attested" places for the highest-confidence view).
- **Random exploration**: The **Rand** button in the map left panel selects a random visible place — useful for discovering less-known locations in a given century.
