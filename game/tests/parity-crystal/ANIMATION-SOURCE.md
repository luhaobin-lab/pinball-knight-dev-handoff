# Counter override timing

Blueprint `蓝图_效果_反击状态.txt` L15 starts the owner's animation[5] at play rate .8, then passes the returned
AnimationLength to a repeating timer. L1329 replaces the same default slot every timer callback.

The installed reference binary directly resolves the previously ambiguous returned value:

- Reflection `dump/native/engine-reflection.json` names `K2_PlayAnimationOverride`, exec `0x1448b30c0`.
- PlayRate is loaded into xmm7 and stored in the active slot at +0x1c (`0x1448b3380`).
- `0x1448b3598..0x1448b35a4` calls the sequence virtual length accessor at vtable+0x2b8 and writes xmm0 directly
  to the AnimationLength out pointer r15. It does not divide by PlayRate.
- Exact disassembly and executable SHA are retained at
  `D:/TAPTAPGAME_codex/studio/logs/parity-enemy-crystal-brain/body-native/animation-override.{asm,json}`.

Thus the .4-second sequence is displayed at .8 rate (.5 seconds), while the source timer replaces it every .4
seconds. The real latent slot now scales notify times and completion together; replacing/destroying the caller
continues to cancel the previous pending delegates. Existing callers default to rate1 and strong scheduling.
This passive repeating pose alone requests weak scheduling so it cannot indefinitely keep headless simulation busy.
Negative and zero play rates are outside this source call and remain unsupported.
