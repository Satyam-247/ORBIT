#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define MAX_PROCESSES 100
#define MAX_RESOURCES 10

typedef struct {
    int id;
    int allocation[MAX_RESOURCES];
    int maximum[MAX_RESOURCES];
    int need[MAX_RESOURCES];
} Process;

static bool safe_sequence(Process p[], int n, int m, int available[], int sequence[]) {
    bool finished[MAX_PROCESSES] = {false};
    int work[MAX_RESOURCES];
    for (int r = 0; r < m; r++) work[r] = available[r];
    int completed = 0;
    while (completed < n) {
        bool progress = false;
        for (int i = 0; i < n; i++) {
            if (finished[i]) continue;
            bool can_finish = true;
            for (int r = 0; r < m; r++) {
                if (p[i].need[r] > work[r]) { can_finish = false; break; }
            }
            if (!can_finish) continue;
            for (int r = 0; r < m; r++) work[r] += p[i].allocation[r];
            sequence[completed++] = i;
            finished[i] = true;
            progress = true;
        }
        if (!progress) return false;
    }
    return true;
}

int main(void) {
    int n, m;
    if (scanf("%d %d", &n, &m) != 2 || n < 1 || n > MAX_PROCESSES || m < 1 || m > MAX_RESOURCES) {
        fprintf(stderr, "Invalid process/resource dimensions.\n"); return 2;
    }
    int available[MAX_RESOURCES];
    for (int r = 0; r < m; r++) {
        if (scanf("%d", &available[r]) != 1 || available[r] < 0) { fprintf(stderr, "Invalid available vector.\n"); return 2; }
    }
    Process processes[MAX_PROCESSES];
    for (int i = 0; i < n; i++) {
        if (scanf("%d", &processes[i].id) != 1 || processes[i].id < 1) { fprintf(stderr, "Invalid process ID.\n"); return 2; }
        for (int r = 0; r < m; r++) {
            if (scanf("%d", &processes[i].allocation[r]) != 1 || processes[i].allocation[r] < 0) { fprintf(stderr, "Invalid allocation matrix.\n"); return 2; }
        }
        for (int r = 0; r < m; r++) {
            if (scanf("%d", &processes[i].maximum[r]) != 1 || processes[i].maximum[r] < processes[i].allocation[r]) { fprintf(stderr, "Invalid maximum matrix.\n"); return 2; }
            processes[i].need[r] = processes[i].maximum[r] - processes[i].allocation[r];
        }
        for (int j = 0; j < i; j++) if (processes[j].id == processes[i].id) { fprintf(stderr, "Duplicate process ID.\n"); return 2; }
    }
    int sequence[MAX_PROCESSES];
    bool safe = safe_sequence(processes, n, m, available, sequence);
    printf("{\"safe\":%s,\"safeSequence\":[", safe ? "true" : "false");
    if (safe) for (int i = 0; i < n; i++) printf("%s%d", i ? "," : "", processes[sequence[i]].id);
    printf("],\"available\":[");
    for (int r = 0; r < m; r++) printf("%s%d", r ? "," : "", available[r]);
    printf("],\"processes\":[");
    for (int i = 0; i < n; i++) {
        printf("%s{\"id\":%d,\"allocation\":[", i ? "," : "", processes[i].id);
        for (int r = 0; r < m; r++) printf("%s%d", r ? "," : "", processes[i].allocation[r]);
        printf("],\"maximum\":[");
        for (int r = 0; r < m; r++) printf("%s%d", r ? "," : "", processes[i].maximum[r]);
        printf("],\"need\":[");
        for (int r = 0; r < m; r++) printf("%s%d", r ? "," : "", processes[i].need[r]);
        printf("]}");
    }
    puts("]}");
    return 0;
}
