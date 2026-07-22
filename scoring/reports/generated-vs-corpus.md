# Generated vs corpus

Corpus: 207 scored. Generated: 35 scored, 10 high-rated (4–5), 7 low-rated (1–2).

All boards re-scored at the current `game/scoring.ts` calibration. The
question this answers: which metrics separate the boards a human kept from
the ones they rejected — i.e. which advisory signals are worth promoting.

## Metric distributions (min / median / max)

| metric | corpus (min/med/max) | high-rated | low-rated |
| --- | --- | --- | --- |
| score | 0.049 / 0.213 / 0.439 | 0.127 / 0.237 / 0.396 | 0.087 / 0.256 / 0.350 |
| worst | 0.049 / 0.199 / 0.432 | 0.116 / 0.221 / 0.384 | 0.087 / 0.208 / 0.326 |
| deception | 0.000 / 3.000 / 9.000 | 1.000 / 3.000 / 9.000 | 1.000 / 4.000 / 11.000 |
| reversals | 0.000 / 1.000 / 3.000 | 0.000 / 1.000 / 3.000 | 0.000 / 1.000 / 2.000 |
| setupRatio | 0.143 / 0.500 / 0.800 | 0.286 / 0.714 / 0.889 | 0.286 / 0.667 / 0.857 |
| firstMovePrecision | 0.100 / 0.333 / 1.000 | 0.125 / 0.250 / 0.500 | 0.091 / 0.167 / 0.500 |
| uniqueSolutions | 1.000 / 3.000 / 20.000 | 1.000 / 5.000 / 9.000 | 1.000 / 5.000 / 27.000 |
| deadSpace | 0.063 / 0.531 / 0.813 | 0.219 / 0.547 / 0.719 | 0.141 / 0.375 / 0.688 |
| wallUtilization | 0.000 / 0.214 / 1.000 | 0.200 / 0.313 / 0.556 | 0.200 / 0.250 / 0.400 |

## Per-reason-tag metric means

| reason | n | score | worst | deception | reversals | setupRatio | firstMovePrecision | uniqueSolutions | deadSpace | wallUtilization |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| meh | 6 | 0.264 | 0.244 | 3.500 | 1.000 | 0.617 | 0.257 | 5.000 | 0.422 | 0.326 |
| too-easy | 18 | 0.215 | 0.194 | 3.222 | 0.944 | 0.595 | 0.278 | 6.056 | 0.484 | 0.306 |
| empty-areas | 3 | 0.266 | 0.254 | 5.000 | 1.000 | 0.732 | 0.225 | 3.000 | 0.438 | 0.360 |
| nice | 13 | 0.237 | 0.223 | 3.154 | 0.923 | 0.630 | 0.264 | 5.615 | 0.458 | 0.337 |
| clumped | 6 | 0.264 | 0.229 | 4.167 | 1.667 | 0.639 | 0.199 | 6.667 | 0.422 | 0.323 |
| boring | 2 | 0.276 | 0.240 | 4.000 | 1.500 | 0.786 | 0.155 | 5.500 | 0.359 | 0.243 |
