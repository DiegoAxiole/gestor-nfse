# SYSTEM INSTRUCTIONS: MANDATORY DEVELOPMENT WORKFLOW

You must strictly follow the sequential workflow defined below. Do not skip any phase. Transition to the next phase ONLY after the current phase criteria are fully satisfied and verified.

## WORKFLOW SEQUENCING

### 1. PHASE: brainstorming
*   **Trigger:** Activates immediately before writing any code or plans.
*   **Action:** 
    *   Refine rough ideas by asking clarifying questions.
    *   Explore architectural alternatives.
    *   Present the final design in clear sections for validation.
    *   Save the approved design document.
*   **Exit Condition:** Design document is saved and user explicit approval is granted.

### 2. PHASE: using-git-worktrees
*   **Trigger:** Activates immediately after design approval.
*   **Action:** 
    *   Create an isolated workspace on a new git branch.
    *   Run the initial project setup.
    *   Verify a clean test baseline before making changes.
*   **Exit Condition:** Clean test baseline confirmed on the isolated worktree.

### 3. PHASE: writing-plans
*   **Trigger:** Activates once the worktree environment is verified.
*   **Action:** 
    *   Break the work down into bite-sized tasks (2-5 minutes each).
    *   Specify exact file paths for every task.
    *   Include complete code expectations and strict verification steps for each step.
*   **Exit Condition:** Checklist of atomic tasks is generated and documented.

### 4. PHASE: executing-plans OR subagent-driven-development
*   **Trigger:** Activates once the plan is fully written.
*   **Action:** 
    *   **Option A:** Dispatch a fresh subagent per task with a two-stage review (spec compliance, then code quality).
    *   **Option B:** Execute tasks in batches with manual human checkpoints.
*   **Exit Condition:** Tasks are executed according to the selected mode.

### 5. PHASE: test-driven-development
*   **Trigger:** Activates continuously during the implementation of any task.
*   **Action:** 
    *   Enforce strict RED-GREEN-REFACTOR cycle.
    *   Write a failing test first and watch it fail (RED).
    *   Write the minimal production code required to pass the test (GREEN).
    *   Refactor the code and commit (REFACTOR).
    *   **CRITICAL:** Delete any production code written prior to its corresponding test.
*   **Exit Condition:** All code changes are backed by passing TDD cycles.

### 6. PHASE: requesting-code-review
*   **Trigger:** Activates systematically between task transitions.
*   **Action:** 
    *   Review the implemented changes directly against the active plan.
    *   Report found issues categorized by severity.
    *   **CRITICAL:** Block all progress if any Critical Issue is found.
*   **Exit Condition:** Code review passes with zero critical blocks.

### 7. PHASE: finishing-a-development-branch
*   **Trigger:** Activates only when all tasks in the plan are fully completed.
*   **Action:** 
    *   Run final verification on the entire test suite.
    *   Present clear options to the user: Merge, PR, Keep, or Discard.
    *   Clean up and remove the used worktree.
*   **Exit Condition:** Repository is clean and branch lifecycle is finalized.

## STRICT ENFORCEMENT RULES
1. Never execute a task from a later phase without completing the current phase.
2. If tests fail or code review blocks progress, immediately roll back to the corresponding phase (e.g., return to phase 5 or phase 3).
3. Explicitly state the active phase at the beginning of each response using the format: `[ACTIVE PHASE: name-of-the-phase]`.
