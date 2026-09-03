---
name: Christine
slug: christine
createdAt: 2026-09-03T19:13:16.745Z
difficulty: medium
minMoves: 8
genOptions:
  wallsRange:
    - 10
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.65
  targetMoves: 8
generatorVersion: 0.7.0
scoring:
  score: 0.3721
  mean: 0.3721
  min: 0.3619
  stddev: 0.0103
  metrics:
    setupRatio: 0.25
    coverage: 0.3594
    deception: 7
    reversals: 0
    crossTrailOverlap: 8
    totalDistance: 32
    pieceUsage: 4.1699
    stopWeighted: 14
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 2
    wallUtilization: 0.4118
    deadSpace: 0.3594
    puckPathVariety: 1
    clumping: 0.1056
    emptyRegion: 0.2031
    wallSymmetry: 0.8235
    firstMovePrecision: 0.25
    searchProfile: 0.9207
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: H8H1-G1-G3-D3-D1-C1C8-D1C1-C7
      score: 0.3824
      metrics:
        setupRatio: 0.125
        coverage: 0.3594
        deception: 7
        reversals: 0
        crossTrailOverlap: 7
        totalDistance: 29
        pieceUsage: 2.585
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.4118
        deadSpace: 0.3594
        puckPathVariety: 1
        clumping: 0.1056
        emptyRegion: 0.2031
        wallSymmetry: 0.8235
        firstMovePrecision: 0.25
        searchProfile: 0.9207
        isolationGap: 0
        nearMissCount: 0
    - moves: H8G8-G6-F6-F1-C1C8-E1E8-F1C1-C7
      score: 0.3619
      metrics:
        setupRatio: 0.25
        coverage: 0.2969
        deception: 5
        reversals: 0
        crossTrailOverlap: 8
        totalDistance: 32
        pieceUsage: 4.1699
        stopWeighted: 14
        pointlessClearance: 1
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.4118
        deadSpace: 0.3594
        puckPathVariety: 1
        clumping: 0.1056
        emptyRegion: 0.2031
        wallSymmetry: 0.8235
        firstMovePrecision: 0.25
        searchProfile: 0.9207
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
solutionTags:
  H8G8-G6-F6-F1-C1C8-E1E8-F1C1-C7:
    - boring
rating: 2.5
reasons:
  - empty-areas
---

```
+ A B C D E F G H +
1    |#   #  |    |
2      |   |      |
3      |      _   |
4      |#  |      |
5   _  |#  |  _   |
6      |   |      |
7     X|          |
8    |       |  @ |
+-----------------+
```
