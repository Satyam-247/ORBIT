#include <stdio.h>
#include <stdbool.h>

#define PROCESSES 5
#define RESOURCES 3

// Current allocated resources for each process (P0 to P4)
int allocation[PROCESSES][RESOURCES] = {
    {0, 1, 0},
    {2, 0, 0},
    {3, 0, 2},
    {2, 1, 1},
    {0, 0, 2}
};

// Maximum resources each process might need
int max_claim[PROCESSES][RESOURCES] = {
    {7, 5, 3},
    {3, 2, 2},
    {9, 0, 2},
    {2, 2, 2},
    {4, 3, 3}
};

// Available resources in the system
int available[RESOURCES] = {3, 3, 2};

// Remaining resources needed: need = max_claim - allocation
int need[PROCESSES][RESOURCES];

// Calculate how many more resources each process needs
void calculate_need() {
    for (int i = 0; i < PROCESSES; i++) {
        for (int j = 0; j < RESOURCES; j++) {
            need[i][j] = max_claim[i][j] - allocation[i][j];
        }
    }
}

// Banker's Safety Algorithm to detect if deadlock can occur
bool check_safe_state(int safe_seq[]) {
    int work[RESOURCES];
    bool finish[PROCESSES] = {false};

    for (int i = 0; i < RESOURCES; i++) {
        work[i] = available[i];
    }

    int count = 0;
    while (count < PROCESSES) {
        bool found = false;
        for (int p = 0; p < PROCESSES; p++) {
            if (!finish[p]) {
                int r;
                for (r = 0; r < RESOURCES; r++) {
                    if (need[p][r] > work[r]) {
                        break;
                    }
                }

                // If process p can get all resources it needs
                if (r == RESOURCES) {
                    for (int k = 0; k < RESOURCES; k++) {
                        work[k] += allocation[p][k];
                    }
                    safe_seq[count++] = p;
                    finish[p] = true;
                    found = true;
                }
            }
        }

        // If no process could proceed, the system is deadlocked / unsafe
        if (!found) {
            return false;
        }
    }
    return true;
}

int main() {
    printf("==========================================\n");
    printf("   ORBIT Scheduler - Deadlock Detector    \n");
    printf("==========================================\n\n");

    calculate_need();

    printf("Calculating resource need matrix...\n");
    printf("Checking for safe execution sequence...\n\n");

    int safe_sequence[PROCESSES];

    if (check_safe_state(safe_sequence)) {
        printf(">>> STATUS: SYSTEM IS IN A SAFE STATE (NO DEADLOCK)\n");
        printf(">>> Safe Process Execution Order: ");
        for (int i = 0; i < PROCESSES; i++) {
            printf("P%d", safe_sequence[i]);
            if (i < PROCESSES - 1) {
                printf(" -> ");
            }
        }
        printf("\n\nAll processes can finish without getting stuck!\n");
    } else {
        printf(">>> STATUS: DEADLOCK / UNSAFE STATE DETECTED!\n");
        printf(">>> The system halted execution to avoid getting stuck.\n");
    }

    printf("==========================================\n");
    return 0;
}
