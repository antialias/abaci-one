# Regrouping (Carrying and Borrowing)

## What is Regrouping?

Regrouping is what happens when a column's sum exceeds 9 (addition) or when you need to borrow from a higher place value (subtraction).

### Addition Example

```
    47
  + 85
  ----
```

- Ones column: 7 + 5 = 12 → write 2, carry the 1
- Tens column: 4 + 8 + 1(carried) = 13 → write 3, carry the 1
- Result: 132

The "carrying" is regrouping - you're regrouping 12 ones as 1 ten and 2 ones.

### Subtraction Example

```
    42
  - 17
  ----
```

- Ones column: 2 - 7 → can't do it, borrow from tens
- Regroup: 42 = 30 + 12 (borrow 1 ten, add 10 ones)
- Now: 12 - 7 = 5, 3 - 1 = 2
- Result: 25

## Regrouping Parameters

### `pAnyStart` (0.0 - 1.0)

Probability that **at least one column** requires regrouping.

- `0.0` = No regrouping ever (e.g., 23 + 14)
- `0.5` = Half the problems have at least one regroup
- `1.0` = Every problem has at least one regroup

### `pAllStart` (0.0 - 1.0)

Probability that **every column** requires regrouping (compound/cascading).

- `0.0` = Simple regrouping only (one column at a time)
- `0.5` = Half the problems have multiple regroups
- `1.0` = Every problem has cascading regroups (e.g., 789 + 456)

### Pedagogical Progression

| Stage               | pAnyStart | pAllStart | Focus                                |
| ------------------- | --------- | --------- | ------------------------------------ |
| Learning structure  | 0%        | 0%        | Place value alignment, no regrouping |
| Introducing concept | 25%       | 0%        | Occasional single regroups           |
| Practicing skill    | 75%       | 25%       | Frequent regrouping with scaffolding |
| Building fluency    | 75%       | 25%       | Same frequency, less scaffolding     |
| Mastery             | 90%       | 50%       | Complex problems, no scaffolding     |

## Why This Matters

Students often learn the mechanics of addition before encountering regrouping. Introducing it gradually:

1. Builds confidence with the base algorithm
2. Isolates the new concept (carrying/borrowing)
3. Prevents cognitive overload
4. Allows scaffolding to be systematically removed
