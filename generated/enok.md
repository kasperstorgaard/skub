---
name: Enok
slug: enok
createdAt: 2026-07-22T19:29:10.294Z
difficulty: medium
minMoves: 8
genOptions:
  wallsRange:
    - 8
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.8
  targetMoves: 8
generatorVersion: 0.7.0
scoring:
  score: 0.4339
  mean: 0.4339
  min: 0.4253
  stddev: 0.0071
  metrics:
    setupRatio: 0.75
    coverage: 0.2188
    deception: 1
    reversals: 0
    crossTrailOverlap: 7
    totalDistance: 25
    pieceUsage: 6.1699
    stopWeighted: 17
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 3
    wallUtilization: 0.3333
    deadSpace: 0.6875
    puckPathVariety: 1
    clumping: 0.0972
    emptyRegion: 0.5313
    wallSymmetry: 0.8333
    firstMovePrecision: 0.3333
    searchProfile: 0.9225
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: B8B1-D2H2-C3B3-B2-B1A1-A2-B2G2-A2F2
      score: 0.4253
      metrics:
        setupRatio: 0.5
        coverage: 0.2188
        deception: 1
        reversals: 0
        crossTrailOverlap: 7
        totalDistance: 25
        pieceUsage: 5.4919
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.3333
        deadSpace: 0.6875
        puckPathVariety: 1
        clumping: 0.0972
        emptyRegion: 0.5313
        wallSymmetry: 0.8333
        firstMovePrecision: 0.3333
        searchProfile: 0.9225
        isolationGap: 0
        nearMissCount: 0
    - moves: B8B1-D2H2-C3B3-B2-B1C1-B2G2-C1C2-F2
      score: 0.4337
      metrics:
        setupRatio: 0.5
        coverage: 0.2031
        deception: 0
        reversals: 0
        crossTrailOverlap: 7
        totalDistance: 23
        pieceUsage: 5.4919
        stopWeighted: 17
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 3
        wallUtilization: 0.3333
        deadSpace: 0.6875
        puckPathVariety: 1
        clumping: 0.0972
        emptyRegion: 0.5313
        wallSymmetry: 0.8333
        firstMovePrecision: 0.3333
        searchProfile: 0.9225
        isolationGap: 0
        nearMissCount: 0
    - moves: D2H2-C3B3-B1-B8B2-B1C1-C2-G2-B2F2
      score: 0.4427
      metrics:
        setupRatio: 0.75
        coverage: 0.1719
        deception: 0
        reversals: 0
        crossTrailOverlap: 7
        totalDistance: 23
        pieceUsage: 6.1699
        stopWeighted: 17
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 3
        uniqueSolutions: 3
        wallUtilization: 0.3333
        deadSpace: 0.6875
        puckPathVariety: 1
        clumping: 0.0972
        emptyRegion: 0.5313
        wallSymmetry: 0.8333
        firstMovePrecision: 0.3333
        searchProfile: 0.9225
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
solutionTags:
  B8B1-D2H2-C3B3-B2-B1A1-A2-B2G2-A2F2:
    - interesting
    - unique
  B8B1-D2H2-C3B3-B2-B1C1-B2G2-C1C2-F2:
    - interesting
  D2H2-C3B3-B1-B8B2-B1C1-C2-G2-B2F2:
    - interesting
    - boring
rating: 3.5
reasons: []
---

```
+ A B C D E F G H +
1      |   |      |
2 _   _ #   X   _ |
3 #|  #           |
4               # |
5                 |
6 _|  _        |_ |
7                 |
8   @  |          |
+-----------------+
```
