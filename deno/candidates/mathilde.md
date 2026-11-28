---
name: Mathilde
slug: mathilde
createdAt: 2026-09-03T19:03:30.256Z
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
  score: 0.4372
  mean: 0.4372
  min: 0.3825
  stddev: 0.0333
  metrics:
    setupRatio: 0.625
    coverage: 0.2813
    deception: 5
    reversals: 2
    crossTrailOverlap: 11
    totalDistance: 32
    pieceUsage: 7.4919
    stopWeighted: 18
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 4
    wallUtilization: 0.2727
    deadSpace: 0.5156
    puckPathVariety: 1
    clumping: 0.0871
    emptyRegion: 0.0938
    wallSymmetry: 0.7273
    firstMovePrecision: 0.3333
    searchProfile: 0.9558
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: G2G1-D1-D7D2-E2-D1D8-E8-E3-D3
      score: 0.3825
      metrics:
        setupRatio: 0.25
        coverage: 0.2813
        deception: 5
        reversals: 0
        crossTrailOverlap: 6
        totalDistance: 24
        pieceUsage: 3
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.5156
        puckPathVariety: 1
        clumping: 0.0871
        emptyRegion: 0.0938
        wallSymmetry: 0.7273
        firstMovePrecision: 0.3333
        searchProfile: 0.9558
        isolationGap: 0
        nearMissCount: 0
    - moves: G5G8-G2G7-E7-G8G1-D1-D7D2-E7D7-D3
      score: 0.457
      metrics:
        setupRatio: 0.5
        coverage: 0.2031
        deception: 3
        reversals: 1
        crossTrailOverlap: 11
        totalDistance: 30
        pieceUsage: 6.1699
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 1
        openingSetup: 1
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.5156
        puckPathVariety: 1
        clumping: 0.0871
        emptyRegion: 0.0938
        wallSymmetry: 0.7273
        firstMovePrecision: 0.3333
        searchProfile: 0.9558
        isolationGap: 0
        nearMissCount: 0
    - moves: G5G8-G2G7-H7-G8G1-D1-D7D2-H7D7-D3
      score: 0.4696
      metrics:
        setupRatio: 0.5
        coverage: 0.2188
        deception: 4
        reversals: 2
        crossTrailOverlap: 11
        totalDistance: 32
        pieceUsage: 5.7549
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.5156
        puckPathVariety: 1
        clumping: 0.0871
        emptyRegion: 0.0938
        wallSymmetry: 0.7273
        firstMovePrecision: 0.3333
        searchProfile: 0.9558
        isolationGap: 0
        nearMissCount: 0
    - moves: G5G8-G2G7-B6E6-E1-D1-D7D2-G7D7-D3
      score: 0.4396
      metrics:
        setupRatio: 0.625
        coverage: 0.2031
        deception: 3
        reversals: 0
        crossTrailOverlap: 8
        totalDistance: 29
        pieceUsage: 7.4919
        stopWeighted: 17
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 1
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.5156
        puckPathVariety: 1
        clumping: 0.0871
        emptyRegion: 0.0938
        wallSymmetry: 0.7273
        firstMovePrecision: 0.3333
        searchProfile: 0.9558
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
rating: 4
reasons: []
solutionTags:
  G2G1-D1-D7D2-E2-D1D8-E8-E3-D3:
    - interesting
  G5G8-G2G7-B6E6-E1-D1-D7D2-G7D7-D3:
    - boring
  G5G8-G2G7-H7-G8G1-D1-D7D2-H7D7-D3:
    - interesting
    - unique
promotedAs: mathilde
---

```
+ A B C D E F G H +
1      |          |
2 _        |  @   |
3  |  _|X  |_  |  |
4 _    |   |    _ |
5     _    |_ # # |
6 #̲|#      |   |  |
7      |#         |
8          |      |
+-----------------+
```
