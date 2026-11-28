---
name: Emily
slug: emily
createdAt: 2026-09-03T19:19:27.929Z
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
  score: 0.4881
  mean: 0.4881
  min: 0.4373
  stddev: 0.0364
  metrics:
    setupRatio: 0.4444
    coverage: 0.2969
    deception: 9
    reversals: 3
    crossTrailOverlap: 5
    totalDistance: 28
    pieceUsage: 6.7549
    stopWeighted: 20
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 4
    wallUtilization: 0.375
    deadSpace: 0.4844
    puckPathVariety: 1
    clumping: 0.1032
    emptyRegion: 0.4531
    wallSymmetry: 0.625
    firstMovePrecision: 0.3333
    searchProfile: 0.9244
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: B2B1-E1-E6-F1F2-G1B1-F2F1-B1E1-E6E2-D2
      score: 0.5169
      metrics:
        setupRatio: 0.4444
        coverage: 0.1719
        deception: 4
        reversals: 3
        crossTrailOverlap: 5
        totalDistance: 24
        pieceUsage: 5.9069
        stopWeighted: 19
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.375
        deadSpace: 0.4844
        puckPathVariety: 1
        clumping: 0.1032
        emptyRegion: 0.4531
        wallSymmetry: 0.625
        firstMovePrecision: 0.3333
        searchProfile: 0.9244
        isolationGap: 0
        nearMissCount: 0
    - moves: B2B1-F1C1-B1B2-A2-A8-G1D1-E7E8-A8D8-D2
      score: 0.4704
      metrics:
        setupRatio: 0.3333
        coverage: 0.2813
        deception: 8
        reversals: 1
        crossTrailOverlap: 3
        totalDistance: 25
        pieceUsage: 6.7549
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.375
        deadSpace: 0.4844
        puckPathVariety: 1
        clumping: 0.1032
        emptyRegion: 0.4531
        wallSymmetry: 0.625
        firstMovePrecision: 0.3333
        searchProfile: 0.9244
        isolationGap: 0
        nearMissCount: 0
    - moves: B2B1-F1C1-C2-B1F1-C2C1-F1D1-D8-G1D1-D8D2
      score: 0.5277
      metrics:
        setupRatio: 0.4444
        coverage: 0.2031
        deception: 6
        reversals: 3
        crossTrailOverlap: 4
        totalDistance: 28
        pieceUsage: 6.1699
        stopWeighted: 20
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.375
        deadSpace: 0.4844
        puckPathVariety: 1
        clumping: 0.1032
        emptyRegion: 0.4531
        wallSymmetry: 0.625
        firstMovePrecision: 0.3333
        searchProfile: 0.9244
        isolationGap: 0
        nearMissCount: 0
    - moves: B2C2-C1-F1D1-C1C2-A2-A8-E7E8-A8D8-D2
      score: 0.4373
      metrics:
        setupRatio: 0.2222
        coverage: 0.2969
        deception: 9
        reversals: 1
        crossTrailOverlap: 0
        totalDistance: 23
        pieceUsage: 4.7549
        stopWeighted: 17
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.375
        deadSpace: 0.4844
        puckPathVariety: 1
        clumping: 0.1032
        emptyRegion: 0.4531
        wallSymmetry: 0.625
        firstMovePrecision: 0.3333
        searchProfile: 0.9244
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
source: generated
solutionTags:
  B2C2-C1-F1D1-C1C2-A2-A8-E7E8-A8D8-D2:
    - interesting
    - unique
  B2B1-F1C1-B1B2-A2-A8-G1D1-E7E8-A8D8-D2:
    - interesting
    - unique
  B2B1-E1-E6-F1F2-G1B1-F2F1-B1E1-E6E2-D2:
    - interesting
    - unique
  B2B1-F1C1-C2-B1F1-C2C1-F1D1-D8-G1D1-D8D2:
    - interesting
    - unique
rating: 5
reasons:
  - empty-areas
note: 5 on complexity/solutions
promotedAs: emily
---

```
+ A B C D E F G H +
1  |        # #|  |
2   @̲ _|X  |_     |
3                 |
4    |            |
5    |       |  # |
6     _   _ _ _   |
7         #|      |
8              |  |
+-----------------+
```
