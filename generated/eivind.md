---
name: Eivind
slug: eivind
createdAt: 2026-07-22T19:29:10.294Z
difficulty: medium
minMoves: 7
genOptions:
  wallsRange:
    - 6
    - 17
  blockersRange:
    - 2
    - 7
  wallSpread: spread
  symmetry: 0.7
  targetMoves: 7
generatorVersion: 0.7.0
scoring:
  score: 0.4016
  mean: 0.4016
  min: 0.4016
  stddev: 0
  metrics:
    setupRatio: 0.5714
    coverage: 0.2188
    deception: 0
    reversals: 0
    crossTrailOverlap: 0
    totalDistance: 25
    pieceUsage: 5.4919
    stopWeighted: 14
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 1
    wallUtilization: 0.2143
    deadSpace: 0.5625
    puckPathVariety: 1
    clumping: 0.1739
    emptyRegion: 0.6094
    wallSymmetry: 0.8571
    firstMovePrecision: 0.3333
    searchProfile: 0.693
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: B7B1-G3G1-B1F1-H7C7-C5-F5-F1F4
      score: 0.4016
      metrics:
        setupRatio: 0.5714
        coverage: 0.2188
        deception: 0
        reversals: 0
        crossTrailOverlap: 0
        totalDistance: 25
        pieceUsage: 5.4919
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 1
        wallUtilization: 0.2143
        deadSpace: 0.5625
        puckPathVariety: 1
        clumping: 0.1739
        emptyRegion: 0.6094
        wallSymmetry: 0.8571
        firstMovePrecision: 0.3333
        searchProfile: 0.693
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
solutionTags:
  B7B1-G3G1-B1F1-H7C7-C5-F5-F1F4:
    - too-easy
    - boring
rating: 1.5
reasons:
  - empty-areas
  - ugly
  - clumped
---

```
+ A B C D E F G H +
1                 |
2    | |   | |    |
3    |       |#   |
4    |_     X|    |
5    |       |    |
6    |       |    |
7   @|          # |
8                 |
+-----------------+
```
