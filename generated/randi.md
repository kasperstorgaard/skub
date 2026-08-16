---
name: Randi
slug: randi
createdAt: 2026-07-22T19:29:10.294Z
difficulty: medium
minMoves: 7
genOptions:
  wallsRange:
    - 8
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.8
  targetMoves: 7
generatorVersion: 0.7.0
scoring:
  score: 0.3447
  mean: 0.3447
  min: 0.3447
  stddev: 0
  metrics:
    setupRatio: 0.1429
    coverage: 0.3125
    deception: 5
    reversals: 0
    crossTrailOverlap: 4
    totalDistance: 21
    pieceUsage: 4.1699
    stopWeighted: 14
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 1
    uniqueSolutions: 2
    wallUtilization: 0.1818
    deadSpace: 0.5
    puckPathVariety: 1
    clumping: 0.1179
    emptyRegion: 0.1875
    wallSymmetry: 0.8182
    firstMovePrecision: 0.5
    searchProfile: 0.8712
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: H2H1-H3H2-F2-F8-B8-B3-C3
      score: 0.3447
      metrics:
        setupRatio: 0.1429
        coverage: 0.3125
        deception: 5
        reversals: 0
        crossTrailOverlap: 1
        totalDistance: 20
        pieceUsage: 4.1699
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 2
        wallUtilization: 0.1818
        deadSpace: 0.5
        puckPathVariety: 1
        clumping: 0.1179
        emptyRegion: 0.1875
        wallSymmetry: 0.8182
        firstMovePrecision: 0.5
        searchProfile: 0.8712
        isolationGap: 0
        nearMissCount: 0
    - moves: H4H8-H3H7-G7-G8-B8-B3-C3
      score: 0.3447
      metrics:
        setupRatio: 0.1429
        coverage: 0.2813
        deception: 5
        reversals: 0
        crossTrailOverlap: 4
        totalDistance: 21
        pieceUsage: 4.1699
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 2
        wallUtilization: 0.1818
        deadSpace: 0.5
        puckPathVariety: 1
        clumping: 0.1179
        emptyRegion: 0.1875
        wallSymmetry: 0.8182
        firstMovePrecision: 0.5
        searchProfile: 0.8712
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
solutionTags:
  H2H1-H3H2-F2-F8-B8-B3-C3:
    - boring
    - too-easy
  H4H8-H3H7-G7-G8-B8-B3-C3:
    - boring
    - too-easy
rating: 1.5
reasons:
  - pretty
  - clumped
note: >-
  lots of unused blockers, and yet another useless blocker just moving out of
  the way. blocker simply moved out of the way is a strong boring signal
---

```
+ A B C D E F G H +
1              |  |
2 # #| |_  |    # |
3 #|  X|   |   |@ |
4 #            |# |
5              |  |
6  |    _ _|   |  |
7    | |   | |    |
8  |           |  |
+-----------------+
```
