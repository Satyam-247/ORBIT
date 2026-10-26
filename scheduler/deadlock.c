#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define MAX_PROCESSES 10
#define MAX_RESOURCES 10

// System state structure
typedef struct {
    int P; // Number of active processes
    int R; // Number of resource types
    int available[MAX_RESOURCES];
    int max[MAX_PROCESSES][MAX_RESOURCES];
    int allocation[MAX_PROCESSES][MAX_RESOURCES];
    int need[MAX_PROCESSES][MAX_RESOURCES];
} SystemState;

// Calculate Need matrix: Need[i][j] = Max[i][j] - Allocation[i][j]
void calculate_need(SystemState *sys) {
    for (int i = 0; i < sys->P; i++) {
        for (int j = 0; j < sys->R; j++) {
            sys->need[i][j] = sys->max[i][j] - sys->allocation[i][j];
        }
    }
}

// Banker's Safety Algorithm
bool is_safe_state(SystemState *sys, int safe_sequence[]) {
    int work[MAX_RESOURCES];
    bool finish[MAX_PROCESSES] = {false};

    for (int j = 0; j < sys->R; j++) {
        work[j] = sys->available[j];
    }

    int count = 0;
    while (count < sys->P) {
        bool found = false;
        for (int p = 0; p < sys->P; p++) {
            if (!finish[p]) {
                bool can_allocate = true;
                for (int j = 0; j < sys->R; j++) {
                    if (sys->need[p][j] > work[j]) {
                        can_allocate = false;
                        break;
                    }
                }

                if (can_allocate) {
                    for (int j = 0; j < sys->R; j++) {
                        work[j] += sys->allocation[p][j];
                    }
                    safe_sequence[count++] = p;
                    finish[p] = true;
                    found = true;
                }
            }
        }

        // If no process could proceed, the state is UNSAFE (Deadlock danger)
        if (!found) {
            return false;
        }
    }
    return true;
}

// OS Resource-Request Algorithm with Automatic Safe Rollback
bool request_resources(SystemState *sys, int process_id, int request[]) {
    printf("\n[OS Scheduler] Process P%d requesting resources: ", process_id);
    for (int j = 0; j < sys->R; j++) printf("%d ", request[j]);
    printf("\n");

    // Condition 1: Check if Request <= Need
    for (int j = 0; j < sys->R; j++) {
        if (request[j] > sys->need[process_id][j]) {
            printf("[ERROR] Process P%d exceeded its maximum declared claim! Request DENIED.\n", process_id);
            return false;
        }
    }

    // Condition 2: Check if Request <= Available
    for (int j = 0; j < sys->R; j++) {
        if (request[j] > sys->available[j]) {
            printf("[WAIT] Resources currently unavailable. Process P%d placed in WAITING queue.\n", process_id);
            return false;
        }
    }

    // Step 3: Trial Allocation (Simulated state)
    for (int j = 0; j < sys->R; j++) {
        sys->available[j] -= request[j];
        sys->allocation[process_id][j] += request[j];
        sys->need[process_id][j] -= request[j];
    }

    // Step 4: Run Safety Check
    int safe_sequence[MAX_PROCESSES];
    if (is_safe_state(sys, safe_sequence)) {
        printf("[SUCCESS] Allocation approved! System remains in a SAFE state.\n");
        printf("Safe execution sequence: ");
        for (int i = 0; i < sys->P; i++) {
            printf("P%d%s", safe_sequence[i], (i == sys->P - 1) ? "\n" : " -> ");
        }
        return true;
    } else {
        // Step 5: DEADLOCK RECOVERY (Rollback trial allocation)
        printf("[DEADLOCK AVOIDED] Unsafe state detected! Rolling back allocation...\n");
        for (int j = 0; j < sys->R; j++) {
            sys->available[j] += request[j];
            sys->allocation[process_id][j] -= request[j];
            sys->need[process_id][j] += request[j];
        }
        printf("[POLICY] Process P%d must wait until other processes release resources.\n", process_id);
        return false;
    }
}

int main() {
    SystemState sys = {
        .P = 5,
        .R = 3,
        .available = {3, 3, 2},
        .max = {
            {7, 5, 3}, // P0
            {3, 2, 2}, // P1
            {9, 0, 2}, // P2
            {2, 2, 2}, // P3
            {4, 3, 3}  // P4
        },
        .allocation = {
            {0, 1, 0}, // P0
            {2, 0, 0}, // P1
            {3, 0, 2}, // P2
            {2, 1, 1}, // P3
            {0, 0, 2}  // P4
        }
    };

    calculate_need(&sys);

    printf("==========================================\n");
    printf("   ORBIT OS Engine - Dynamic Deadlock Core\n");
    printf("==========================================\n");

    // Initial safety check
    int safe_seq[MAX_PROCESSES];
    if (is_safe_state(&sys, safe_seq)) {
        printf("Initial state is SAFE. Safe order: ");
        for (int i = 0; i < sys.P; i++) {
            printf("P%d%s", safe_seq[i], (i == sys.P - 1) ? "\n" : " -> ");
        }
    }

    // TEST CASE 1: Valid safe request by P1 (Request: 1 0 2)
    int req1[] = {1, 0, 2};
    request_resources(&sys, 1, req1);

    // TEST CASE 2: Dangerous request by P0 (Request: 0 2 0) -> Unsafe -> Auto-Rollback
    int req2[] = {0, 2, 0};
    request_resources(&sys, 0, req2);

    return 0;
}
