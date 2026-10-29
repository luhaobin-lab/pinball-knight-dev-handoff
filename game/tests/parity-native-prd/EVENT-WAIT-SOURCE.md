# Integrated seed19: event choice during a real launch

Candidate d6aa25f, seed19/runIndex18 scripted: the natural corruption reward opens at floor12,t315.7333333333.
The hero is still releasing its controllable launch; a finite pending launch callback lies at315.8373415728.
Every immediate modal.pick0 is accepted by the modal transport but source selection does nothing. Rechecking the
ability consumes the source debug roll, so the digest changes and the old unchanged-command detector misses it.
The bounded diagnostic retained1349commands in40seconds; the original120second failed receipt is not overwritten.

Source UI_天赋选项.txt OnMouseButtonDown lines199–201 calls 检查条件/检查子条件 and requires 本技能可释放.
蓝图_能力.txt lines510–511 sets 待机状态通过 = !拥有者.释放技能中. Those source checks are preserved.
The browser advances normally while showing the modal, so the running action can settle before the next click.

The new talents predicate only reads its own currently displayed event options and their owners' cast flags.
`runUntilInput` waits when all displayed event options still have a releasing owner. No skill check/RNG draw runs
inside this predicate. Ordinary `legal` and manual modal.skip/pick remain available; source UI behavior is unchanged.
The scheduler advances the real pending work rather than injecting an arbitrary delay or ending the skill.

Tests replay the exact138-command natural prefix (metadata+SHA in fixture), observe the live event while launch is
pending, verify pure predicate/digest/RNG, then show real `runUntilInput` advances and the source reward gains50gold.
A second game advanced60Hz reaches exactly the same complete digest and post-choice state.
