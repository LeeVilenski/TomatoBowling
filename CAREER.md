# Career Mode: Plan

A single-player ladder. Dave works his way from his home lane to the Golden Pin by beating a run of rival bowlers, one venue at a time. This plan covers how it plays, who's in it, how the opponents bowl, what you earn, and the order to build it in. Nothing here is built yet. The decisions made so far are listed in **Decisions** at the end.

---

## 1. The idea in one paragraph

Each venue is a **league** with three rivals and a **champion**. You play each rival in a head-to-head match, alternating frames as in Pass & Play, with the rival bowling on screen. Beat all three and you earn a shot at the champion. Beat the champion and the next venue opens. Four venues, four champions, then a final at the **Golden Pin Invitational**. One career runs about 15–20 matches. Losing costs nothing but time: you can rematch straight away.

---

## 2. Structure

| Stage | Venue | Rivals | Champion | Unlocks on winning |
|---|---|---|---|---|
| 1 | Tomato Dave's (home) | 3 easy | Carrot Carl | Server Room Lanes |
| 2 | Server Room Lanes | 3 medium | Byte-sized Brie | Disco Inferno |
| 3 | Disco Inferno | 3 tricky | Aubergine Annie | Rooftop at Sunset |
| 4 | Rooftop at Sunset | 3 hard | Big Russet | The Golden Pin |
| Final | The Golden Pin (new venue) | — | The Pumpkin King | Golden Dave suit, credits |

- **Ladder screen:** a vertical "tournament poster" for each venue. The rivals sit as rungs with faces, records and a star rating, and the champion is at the top. Beaten rivals get a stamped tomato.
- **Match lengths:** 5-frame matches against the early rivals, so new players get quick wins, and full 10-frame games against every champion and throughout stage 2 onwards.
- **Turns:** you and the rival alternate frames, as in Pass & Play. The rival's turns can be fast-forwarded.
- **Losing:** no penalty. Rematch any rival straight away.
- **Venue rules** add variety without new systems. Each venue has a twist that changes one existing knob:
  - *Server Room:* **"Long oil"**, a longer oiled section, so the hook comes later and smaller.
  - *Disco:* **"Bouncy pins"**, springier pins that fly further and come back more.
  - *Rooftop:* **"Breezy"**, a gentle sideways push on the ball that changes every frame, shown on screen.
  - *Golden Pin:* **"Dry lanes"**, a shorter oil pattern, so the ball hooks early and hard.

  (Built as lane conditions in the physics, so they affect you and the rivals alike. A shorter power meter was dropped for the Server Room because it would only affect mouse players.)

  All of these are lane friction, oil length or a small constant force in `physics.ts`, so they're cheap to add.

---

## 3. The rivals

Original characters in Dave's world: a mixed bag of foods with day jobs, matching his half-tomato, half-IT humour. Each one has a look, a bowling style, a few speech-bubble lines, and stats the AI bowls from (section 4).

| Rival | Style | Accuracy | Power | Hook | Nerves | Personality |
|---|---|---|---|---|---|---|
| Pickle Pete | Straight and slow | ★☆☆ | ★☆☆ | none | ★★★ | Keen, polite, terrible, sweats brine under pressure |
| Donut Dana | Straight, fast | ★★☆ | ★★★ | none | ★★☆ | All gas, no brakes, a hole in her game |
| Sandy Wich | Small hook | ★★☆ | ★★☆ | ★☆☆ | ★★☆ | Smug about her spares, always layered |
| **Carrot Carl** (champ 1) | Steady | ★★★ | ★★☆ | ★☆☆ | ★★★ | Your old rival from home |
| … medium/hard rivals | | | | | | named per venue |
| **The Pumpkin King** | Big hook, rarely misses | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ | Grand, theatrical, wears a crown |

The rivals reuse Dave's body with a new head (a pickle, a doughnut, a sandwich, a carrot, a wedge of brie, an aubergine, a potato, a pumpkin…) and suit colours. That's the same build-it-in-code approach, so each new character is a head shape, a face texture and a palette, not a new model.

---

## 4. How a rival bowls (the AI)

The rival throws real balls through the **same physics** as you, so their results are honest: they can leave splits, miss spares and get lucky. That needs:

1. **A target.** For a full rack, the rival aims at the pocket: just right of the head pin, coming in at an angle. For a spare, it aims at the middle of the leave (the pins still standing) from the opposite side of the lane. That's standard spare technique and easy to compute from the standing pins.
2. **Finding the throw.** The practice aim helper already runs a throw on a separate, pin-less physics world (`tracePath`) to see where it ends up. The AI uses the same tool: it tries a handful of start positions, angles, speeds and spins and keeps the one that ends nearest the target. That's a few dozen quick simulations, done while Dave's reaction plays.
3. **Making it human.** The chosen throw gets noise from the rival's stats before it's thrown:
   - *Accuracy:* a random error on angle and start position.
   - *Power:* a random error on speed.
   - *Nerves:* extra error in the 10th frame, or when the match is close.

   An easy rival misses the pocket by a board or three; the Pumpkin King barely misses.
4. **Tuning.** Run the AI through `check:physics`-style simulations (say 200 games per rival) and record each rival's average score. Target averages: about 70 for Pickle Pete, about 120 for Carl, 160–180 for stage-3 rivals, about 220 for the Pumpkin King. Tune the noise until each lands in its band. This becomes a regression check, so later physics tweaks can't quietly make a rival unbeatable.

The rival's turn reuses everything that already exists (pinsetter, replay, scoreboard, reactions), so they bowl "on camera" just like Dave. A ⏩ skip would fast-forward the rival's turn for impatient players.

---

## 5. Rewards and progression

- **Stars per match (1–3):** win; win by 30+; win with a turkey or no open frames. Stars give completionists something to chase without blocking progress.
- **Unlocks:** each champion beaten unlocks a cosmetic (a ball or suit themed on that venue: a server-rack-patterned ball, a disco glitter suit, a sunset-gradient ball…) and the next venue for free play.
- **Career stats:** average, best game, strikes, spares converted, splits picked up, head-to-head record against each rival, shown on the ladder screen.
- **No currency or shop.** The existing unlock system (score/feat → cosmetic) fits the game's tone better than coins, and stays simpler to balance.
- **Leaderboard:** career scores shouldn't go on the main leaderboard, since short matches and venue rules aren't comparable. A separate "fastest to the Golden Pin" or "total stars" board could come later.

---

## 6. Screens and flow

```
Menu → Career → Ladder (venue poster)
                 └─ tap a rival → Match intro card (rival face, stats, a line of trash talk, venue rule)
                                  └─ Match (alternating frames, both rows on the scorecard and overhead monitor)
                                       └─ Result card (win/lose, stars, unlocks) → back to Ladder
```

- The **match intro** is a short versus screen: Dave on the left, the rival on the right. It sets the scene and explains the venue rule in one line.
- **During the match:** the HUD scorecard shows both rows. The overhead monitor shows the head-to-head with a "needs X to win" line from the 9th frame. Dave's reaction lines get a few match-specific ones ("Your move, Carl.").
- **The rival's turn:** the camera shows them on the approach (the same rig, with a different character in Dave's place).

---

## 7. Saving

All in `localStorage`, alongside the existing progress, with its own key and version:

```ts
interface CareerSave {
  version: 1;
  stage: number;                     // furthest venue unlocked
  results: Record<RivalId, { wins: number; losses: number; bestStars: 0 | 1 | 2 | 3 }>;
  stats: { games: number; pins: number; strikes: number; spares: number; splitsConverted: number };
  inProgress?: { rival: RivalId; rolls: { you: number[]; them: number[] } }; // resume a match after closing the tab
}
```

---

## 8. Build order

Each step is playable on its own and can ship by itself:

1. ✅ *Built:* **AI bowler on the existing lane.** Rival data, the target-and-search AI, and noise from stats. Add one "vs CPU" quick match to the menu, using Dave's model with a different head. *This is the core risk, so it goes first.* Includes the simulation tuning harness.
2. ✅ *Built (home ladder's four):* **Rival heads.** Pickle, doughnut, sandwich and carrot first (the home ladder), then brie, aubergine, potato and pumpkin: head geometry, face textures and palettes, plus a few reaction lines each.
3. ✅ *Built:* **Ladder for stage 1.** Ladder screen, match intro and result cards, saving, stars. Three rivals plus Carrot Carl at Tomato Dave's.
4. ✅ *Built:* **Stages 2–4.** The remaining rivals and venue rules (long oil, bouncy pins, breeze, dry lanes), each tuned with the harness.
5. ✅ *Built:* **The Golden Pin.** A new final venue (a gold-and-velvet hall, its own music track), the Pumpkin King, and an ending with credits.
6. **Polish.** Career stats page, trash-talk lines, a ⏩ skip for the rival's turn, and perhaps a career leaderboard.

A rough size guide: step 1 is the biggest single piece of work. Steps 2–4 are mostly content once 1 and 3 exist.

**First version = steps 1–3:** the CPU bowler, the home-venue rivals' heads, and the full Tomato Dave's ladder (three rivals plus Carrot Carl). Stages 2–4 and the final follow once the AI and pacing feel right.

---

## Decisions

| Question | Decision |
|---|---|
| Match format | Alternate frames with the rival, like Pass & Play; rival turns can be fast-forwarded |
| Rival cast | A mix of foods (pickle, doughnut, sandwich, carrot, brie, aubergine, potato, pumpkin…) |
| Losing | No penalty: rematch freely |
| Match length | 5 frames against early rivals, 10 against champions and from stage 2 on |
| Venue rules | Yes, one twist per venue (from stage 2; the home venue plays normally) |
| First version | Start small: CPU bowler + the full Tomato Dave's ladder, then grow |
