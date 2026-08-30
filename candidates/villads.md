---
name: Villads
slug: villads
createdAt: 2026-08-30T08:33:16.030Z
difficulty: medium
minMoves: 8
genOptions:
  wallsRange:
    - 6
    - 20
  blockersRange:
    - 3
    - 5
  wallSpread: spread
  symmetry: 0.9
  targetMoves: 8
generatorVersion: 0.7.0
scoring:
  score: 0.5801
  mean: 0.5801
  min: 0.5801
  stddev: 0
  metrics:
    setupRatio: 0.625
    coverage: 0.1875
    deception: 2
    reversals: 1
    crossTrailOverlap: 8
    totalDistance: 29
    pieceUsage: 8.1699
    stopWeighted: 21
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 4
    uniqueSolutions: 1
    wallUtilization: 0.375
    deadSpace: 0.6719
    puckPathVariety: 1
    clumping: 0.0645
    emptyRegion: 0.7031
    wallSymmetry: 1
    firstMovePrecision: 1
    searchProfile: 0.9055
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: C7G7-G5G6-G7B7-B2B6-F2B2-B6F6-B2B6-E6
      score: 0.5801
      metrics:
        setupRatio: 0.625
        coverage: 0.1875
        deception: 2
        reversals: 1
        crossTrailOverlap: 8
        totalDistance: 29
        pieceUsage: 8.1699
        stopWeighted: 21
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 4
        uniqueSolutions: 1
        wallUtilization: 0.375
        deadSpace: 0.6719
        puckPathVariety: 1
        clumping: 0.0645
        emptyRegion: 0.7031
        wallSymmetry: 1
        firstMovePrecision: 1
        searchProfile: 0.9055
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
promotedAs: villads
solutionTags:
  C7G7-G5G6-G7B7-B2B6-F2B2-B6F6-B2B6-E6:
    - interesting
    - unique
reasons:
  - pretty
  - empty-areas
rating: 4
note: tiny bit easy / telegraphed with the amount of blockers / walls
---

```
+ A B C D E F G H +
1                 |
2  |#       @  |  |
3                 |
4  |           |  |
5  |          #|  |
6         X       |
7  |  #        |  |
8                 |
+-----------------+
```
