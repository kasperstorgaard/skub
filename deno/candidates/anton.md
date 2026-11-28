---
name: Anton
slug: anton
createdAt: 2026-09-03T18:45:37.927Z
difficulty: medium
minMoves: 7
genOptions:
  wallsRange:
    - 10
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: balanced
  symmetry: 0.55
  targetMoves: 7
generatorVersion: 0.7.0
scoring:
  score: 0.4513
  mean: 0.4513
  min: 0.4387
  stddev: 0.0126
  metrics:
    setupRatio: 0.4286
    coverage: 0.2031
    deception: 0
    reversals: 1
    crossTrailOverlap: 2
    totalDistance: 22
    pieceUsage: 5.1699
    stopWeighted: 14
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 2
    wallUtilization: 0.3636
    deadSpace: 0.5938
    puckPathVariety: 1
    clumping: 0.0492
    emptyRegion: 0.5
    wallSymmetry: 0.9091
    firstMovePrecision: 0.3333
    searchProfile: 0.8841
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: F7F2-H2-H6-A4A3-H3-H6H4-G4
      score: 0.4638
      metrics:
        setupRatio: 0.2857
        coverage: 0.2031
        deception: 0
        reversals: 1
        crossTrailOverlap: 2
        totalDistance: 22
        pieceUsage: 4.585
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 2
        wallUtilization: 0.3636
        deadSpace: 0.5938
        puckPathVariety: 1
        clumping: 0.0492
        emptyRegion: 0.5
        wallSymmetry: 0.9091
        firstMovePrecision: 0.3333
        searchProfile: 0.8841
        isolationGap: 0
        nearMissCount: 0
    - moves: A4A3-H3-C5F5-F7F6-H6-H4-G4
      score: 0.4387
      metrics:
        setupRatio: 0.4286
        coverage: 0.1094
        deception: 0
        reversals: 0
        crossTrailOverlap: 0
        totalDistance: 17
        pieceUsage: 5.1699
        stopWeighted: 14
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 3
        uniqueSolutions: 2
        wallUtilization: 0.3636
        deadSpace: 0.5938
        puckPathVariety: 1
        clumping: 0.0492
        emptyRegion: 0.5
        wallSymmetry: 0.9091
        firstMovePrecision: 0.3333
        searchProfile: 0.8841
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
solutionTags:
  A4A3-H3-C5F5-F7F6-H6-H4-G4:
    - too-easy
rating: 2.5
reasons:
  - pretty
---

```
+ A B C D E F G H +
1    |      #|    |
2 _               |
3                 |
4 #  |       |X   |
5    |#      |    |
6 _       #     _ |
7           @     |
8    |       |    |
+-----------------+
```
