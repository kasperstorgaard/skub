---
name: Thor
slug: thor
createdAt: 2026-09-03T19:20:51.401Z
difficulty: medium
minMoves: 9
genOptions:
  wallsRange:
    - 10
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.65
  targetMoves: 9
generatorVersion: 0.7.0
scoring:
  score: 0.358
  mean: 0.358
  min: 0.358
  stddev: 0
  metrics:
    setupRatio: 0.2222
    coverage: 0.2969
    deception: 7
    reversals: 0
    crossTrailOverlap: 6
    totalDistance: 25
    pieceUsage: 4.7549
    stopWeighted: 18
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 1
    uniqueSolutions: 1
    wallUtilization: 0.1304
    deadSpace: 0.6406
    puckPathVariety: 1
    clumping: 0.1042
    emptyRegion: 0.2656
    wallSymmetry: 0.8696
    firstMovePrecision: 0.5
    searchProfile: 0.8621
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: A4F4-G4G5-A5-A4-E4-E7E8-E4E7-H7-H6
      score: 0.358
      metrics:
        setupRatio: 0.2222
        coverage: 0.2969
        deception: 7
        reversals: 0
        crossTrailOverlap: 6
        totalDistance: 25
        pieceUsage: 4.7549
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 1
        wallUtilization: 0.1304
        deadSpace: 0.6406
        puckPathVariety: 1
        clumping: 0.1042
        emptyRegion: 0.2656
        wallSymmetry: 0.8696
        firstMovePrecision: 0.5
        searchProfile: 0.8621
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
solutionTags:
  A4F4-G4G5-A5-A4-E4-E7E8-E4E7-H7-H6:
    - interesting
    - unique
rating: 4.5
reasons:
  - pretty
promotedAs: thor
---

```
+ A B C D E F G H +
1    |_      |    |
2     _ #   _     |
3 _|_         #̲|_ |
4 #           @   |
5 _ _         _ _ |
6     _     _  |X |
7     _   # _     |
8    |     | |    |
+-----------------+
```
