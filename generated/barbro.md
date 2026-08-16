---
name: Barbro
slug: barbro
createdAt: 2026-07-22T19:29:10.294Z
difficulty: easy
minMoves: 6
genOptions:
  wallsRange:
    - 8
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.8
  targetMoves: 6
generatorVersion: 0.7.0
scoring:
  score: 0.4976
  mean: 0.4976
  min: 0.4976
  stddev: 0
  metrics:
    setupRatio: 0.6667
    coverage: 0.0938
    deception: 3
    reversals: 1
    crossTrailOverlap: 1
    totalDistance: 20
    pieceUsage: 5.585
    stopWeighted: 15
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 1
    wallUtilization: 0.2
    deadSpace: 0.7031
    puckPathVariety: 1
    clumping: 0.0648
    emptyRegion: 0.4219
    wallSymmetry: 0.9333
    firstMovePrecision: 0.5
    searchProfile: 0.827
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: E7E2-B2D2-D7-H8H7-E7-E2E6
      score: 0.4976
      metrics:
        setupRatio: 0.6667
        coverage: 0.0938
        deception: 3
        reversals: 1
        crossTrailOverlap: 1
        totalDistance: 20
        pieceUsage: 5.585
        stopWeighted: 15
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 1
        wallUtilization: 0.2
        deadSpace: 0.7031
        puckPathVariety: 1
        clumping: 0.0648
        emptyRegion: 0.4219
        wallSymmetry: 0.9333
        firstMovePrecision: 0.5
        searchProfile: 0.827
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
rating: 3.5
reasons:
  - pretty
note: >-
  Nice for an easy, added a tweak to the blocker initial position, see "Barbro".

  Only issue is the amount of dead space (unused areas), but that is ok for an
  easy
---

```
+ A B C D E F G H +
1  |    _ _    |  |
2 _ # _     _   _ |
3                 |
4                 |
5                 |
6 _   _   X _ # _ |
7       _ @̲       |
8              |# |
+-----------------+
```
