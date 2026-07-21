# Generated vs corpus

Corpus: 207 scored. Generated: 28 scored, 4 high-rated (4–5), 5 low-rated (1–2).

All boards re-scored at the current `game/scoring.ts` calibration. The question
this answers: which metrics separate the boards a human kept from the ones they
rejected — i.e. which advisory signals are worth promoting.

## Metric distributions (min / median / max)

| metric             | corpus (min/med/max)   | high-rated            | low-rated              |
| ------------------ | ---------------------- | --------------------- | ---------------------- |
| score              | 0.226 / 0.342 / 0.452  | 0.238 / 0.337 / 0.358 | 0.278 / 0.311 / 0.440  |
| worst              | 0.193 / 0.335 / 0.452  | 0.194 / 0.316 / 0.358 | 0.206 / 0.295 / 0.440  |
| deception          | 0.000 / 3.000 / 9.000  | 1.000 / 3.000 / 4.000 | 2.000 / 3.000 / 5.000  |
| reversals          | 0.000 / 1.000 / 3.000  | 0.000 / 1.000 / 2.000 | 1.000 / 1.000 / 2.000  |
| setupRatio         | 0.143 / 0.500 / 0.800  | 0.429 / 0.444 / 0.571 | 0.286 / 0.714 / 0.714  |
| firstMovePrecision | 0.100 / 0.333 / 1.000  | 0.143 / 0.333 / 0.500 | 0.091 / 0.250 / 1.000  |
| uniqueSolutions    | 1.000 / 3.000 / 20.000 | 1.000 / 4.000 / 6.000 | 1.000 / 5.000 / 49.000 |
| deadSpace          | 0.063 / 0.531 / 0.813  | 0.078 / 0.422 / 0.609 | 0.219 / 0.438 / 0.781  |
| wallUtilization    | 0.000 / 0.214 / 1.000  | 0.250 / 0.444 / 0.571 | 0.200 / 0.333 / 0.667  |

## Per-reason-tag metric means

| reason      | n | score | worst | deception | reversals | setupRatio | firstMovePrecision | uniqueSolutions | deadSpace | wallUtilization |
| ----------- | - | ----- | ----- | --------- | --------- | ---------- | ------------------ | --------------- | --------- | --------------- |
| too-easy    | 4 | 0.329 | 0.302 | 3.500     | 1.500     | 0.536      | 0.392              | 15.000          | 0.500     | 0.388           |
| clumped     | 5 | 0.333 | 0.300 | 3.600     | 1.400     | 0.600      | 0.363              | 12.800          | 0.456     | 0.333           |
| nice        | 3 | 0.326 | 0.283 | 4.000     | 2.000     | 0.593      | 0.189              | 8.333           | 0.234     | 0.481           |
| meh         | 1 | 0.335 | 0.323 | 4.000     | 2.000     | 0.571      | 0.200              | 7.000           | 0.297     | 0.286           |
| empty-areas | 2 | 0.339 | 0.329 | 3.500     | 1.500     | 0.643      | 0.225              | 6.000           | 0.359     | 0.310           |
