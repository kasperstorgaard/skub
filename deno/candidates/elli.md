---
name: Elli
slug: elli
createdAt: 2026-07-22T19:29:10.294Z
difficulty: medium
minMoves: 8
source: generated
promotedAs: elli
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
  score: 0.4827
  mean: 0.4827
  min: 0.4661
  stddev: 0.0144
  metrics:
    setupRatio: 0.875
    coverage: 0.2188
    deception: 4
    reversals: 3
    crossTrailOverlap: 7
    totalDistance: 29
    pieceUsage: 6.3923
    stopWeighted: 17
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 4
    wallUtilization: 0.3684
    deadSpace: 0.5781
    puckPathVariety: 1
    clumping: 0.0805
    emptyRegion: 0.1719
    wallSymmetry: 0.8421
    firstMovePrecision: 0.2
    searchProfile: 0.8792
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: E2E8-G2G1-E1-E7-D7-E8E1-D7E7-E1E6
      score: 0.4735
      metrics:
        setupRatio: 0.625
        coverage: 0.125
        deception: 3
        reversals: 3
        crossTrailOverlap: 7
        totalDistance: 29
        pieceUsage: 3.8074
        stopWeighted: 15
        pointlessClearance: 0
        sameDirectionRepeat: 5
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.3684
        deadSpace: 0.5781
        puckPathVariety: 1
        clumping: 0.0805
        emptyRegion: 0.1719
        wallSymmetry: 0.8421
        firstMovePrecision: 0.2
        searchProfile: 0.8792
        isolationGap: 0
        nearMissCount: 0
    - moves: E2E8-G3G8-E8F8-F6-A6-H7F7-F6-A6E6
      score: 0.4661
      metrics:
        setupRatio: 0.375
        coverage: 0.2188
        deception: 4
        reversals: 1
        crossTrailOverlap: 3
        totalDistance: 26
        pieceUsage: 5.1699
        stopWeighted: 15
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.3684
        deadSpace: 0.5781
        puckPathVariety: 1
        clumping: 0.0805
        emptyRegion: 0.1719
        wallSymmetry: 0.8421
        firstMovePrecision: 0.2
        searchProfile: 0.8792
        isolationGap: 0
        nearMissCount: 0
    - moves: E2D2-G2G1-E1-G3G8-E8-E1E7-D2E2-E6
      score: 0.4873
      metrics:
        setupRatio: 0.625
        coverage: 0.0938
        deception: 1
        reversals: 1
        crossTrailOverlap: 5
        totalDistance: 22
        pieceUsage: 5.9069
        stopWeighted: 16
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.3684
        deadSpace: 0.5781
        puckPathVariety: 1
        clumping: 0.0805
        emptyRegion: 0.1719
        wallSymmetry: 0.8421
        firstMovePrecision: 0.2
        searchProfile: 0.8792
        isolationGap: 0
        nearMissCount: 0
    - moves: G3G8-H7F7-F8-E8-E3-G8E8-E3E7-E2E6
      score: 0.504
      metrics:
        setupRatio: 0.875
        coverage: 0.0781
        deception: 0
        reversals: 1
        crossTrailOverlap: 7
        totalDistance: 24
        pieceUsage: 6.3923
        stopWeighted: 17
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 7
        uniqueSolutions: 4
        wallUtilization: 0.3684
        deadSpace: 0.5781
        puckPathVariety: 1
        clumping: 0.0805
        emptyRegion: 0.1719
        wallSymmetry: 0.8421
        firstMovePrecision: 0.2
        searchProfile: 0.8792
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
solutionTags:
  E2E8-G3G8-E8F8-F6-A6-H7F7-F6-A6E6:
    - too-easy
    - interesting
  E2E8-G2G1-E1-E7-D7-E8E1-D7E7-E1E6:
    - interesting
    - unique
  E2D2-G2G1-E1-G3G8-E8-E1E7-D2E2-E6:
    - interesting
  G3G8-H7F7-F8-E8-E3-G8E8-E3E7-E2E6:
    - interesting
rating: 4
reasons:
  - pretty
---

```
+ A B C D E F G H +
1  |     |     |  |
2   _  |  @|  #̲   |
3 _         _ # _ |
4                 |
5 _   _     _     |
6   _     X       |
7      |   |    # |
8  |     |     |  |
+-----------------+
```
