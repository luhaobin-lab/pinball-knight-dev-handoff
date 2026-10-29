# Knight source restoration

Target: WAVE_B bp-hero-knight's12 real classes, heroes-skills draft verified against each named pseudo.
All12 Knight-owned classes are now implemented, plus the Hunter-owned temporary raw-stat effect required by 蓄力击.
The source owner registry verifies the Knight list but remains a known failure for the explicitly incomplete Hunter
batch. No allowlist/stub has been added, and no G2 content filter has been expanded.

The source grant creates a preview child and separately adds the owned active in acquisition order. Existing active
upgrades preserve identity/cooldown. Source slots exclude launch index0. Digit1/Numpad1 and HUD cell0 address active1.
Slot press follows UI_技能格: phase2, enemies present, no active cast/selection, no live cooldown, then the original
tool facade checks conditions and selects/casts. Listing legal actions/view never calls RNG-bearing condition checks.

举盾 adds maxHP×parameter0 shield immediately, applies the source unique effect, and finishes only after the imported
Actor_C01_Skill animation(.9s). Its next parameter1×stacks hostile bounces each use the current armor for active physical
damage. Success post-release grants trunc(currentCost/2+turnCooldown) morale exactly once; cancellation skips it.

`shield.test.ts`: real natural-combat boundary, source talent acquisition, keyboard/HUD command mapping, .9s completion,
shield18.75 at150HP, source cost0/cooldown3 remaining, two collision hits, upgrade preservation and interrupted completion.
`shield-browser.mjs`: ordinary route reaches combat naturally, then explicitly grants the real source talent as a labelled
boundary fixture. Actual Digit1 and mouse HUD click each cast, show armor and cooldown. It is not natural pool coverage.
`phantom.test.ts` and `phantom-browser.mjs` cover pure source type1 endpoint, real selection/right-click cancellation,
pointer targeting, cooldown10, source curve approach/hops/attack/afterimages, completion and restored piercing profile.
`buffs.test.ts` covers charge100L/stun/removal and blood sacrifice self-damage/base-only accumulation/floor cleanup.
`mover.test.ts`, `profile.test.ts` and `hook-power.test.ts` cover original CurveTable movement, source XY height arc,
PhysicsOnly profile/query exclusion with terrain still blocking, static-hit class/tag metadata, exact scatter draws,
real hook flight/pull/completion and Power Up's card+hero caster provenance and .5s finish. The optional mover physics
hook observes each actual moved segment before arrival; boss overlap implementation belongs to its independent card.

Source sequences: 幻影斩's target indicator uses source type1 full launchDistance,1degree snap and .05uu start plus the
hero-height sphere sweep. 钩锁 source explicitly adds999uu. These are not the ordinary bounce preview. The shell uses
the same pure endpoint for its existing pixel line/range-ring overlay. Ordinary restored roll remains unchanged.
The source profile field is separate from 不可阻挡: enabling it excludes Pawn contacts/queries but keeps terrain;
turning it off restores Pawn. A static hit carries exact geometry classes/tags, never treats every null actor as wall.

Current hero Skill animation is scheduled correctly in core but its special pose is not yet adapted in the renderer;
phantom afterimage sprites and hook rope need dedicated source presentation. The simple indicator has source geometry
and existing Ink/Bone rendering but not the original Niagara animation. These remain explicit presentation needs,
not evidence that complete skill visual parity is achieved. Natural acquisition requires later full content integration.

Proposals: none. Needs: independent review, Hunter dependency closure and the noted source presentation work.
