#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_PROCESSES 100
#define MAX_SEGMENTS 100000
#define MAX_QUEUE 100000

typedef struct {
    int id, arrival, burst, priority;
    int remaining, completion, waiting, turnaround, response, started;
} Process;
typedef struct { int id, start, end; } Segment;

static Process p[MAX_PROCESSES];
static Segment timeline[MAX_SEGMENTS];
static int segment_count = 0;
static void add_segment(int id, int start, int end) {
    if (end <= start || segment_count >= MAX_SEGMENTS) return;
    if (segment_count && timeline[segment_count-1].id == id && timeline[segment_count-1].end == start) {
        timeline[segment_count-1].end = end; return;
    }
    timeline[segment_count++] = (Segment){id,start,end};
}
static void metrics(Process *x, int now) {
    x->completion = now;
    x->turnaround = now - x->arrival;
    x->waiting = x->turnaround - x->burst;
}
static int before(const Process *a, const Process *b) {
    if (a->arrival != b->arrival) return a->arrival < b->arrival;
    return a->id < b->id;
}
static void sort_arrival(int n) {
    for (int i=0;i<n;i++) for (int j=i+1;j<n;j++) if (!before(&p[i],&p[j])) { Process t=p[i];p[i]=p[j];p[j]=t; }
}
static void fcfs(int n) {
    sort_arrival(n); int now=0;
    for (int i=0;i<n;i++) {
        if (now < p[i].arrival) now=p[i].arrival;
        p[i].response=now-p[i].arrival; p[i].started=1;
        int start=now; now+=p[i].burst; add_segment(p[i].id,start,now); metrics(&p[i],now);
    }
}
static void non_preemptive(int n, int use_priority) {
    int done=0, now=0, used[MAX_PROCESSES]={0};
    while (done<n) {
        int k=-1;
        for (int i=0;i<n;i++) if (!used[i] && p[i].arrival<=now) {
            if (k<0 || (use_priority ? p[i].priority<p[k].priority : p[i].burst<p[k].burst) ||
                ((use_priority ? p[i].priority==p[k].priority : p[i].burst==p[k].burst) && before(&p[i],&p[k]))) k=i;
        }
        if (k<0) {
            int next=-1; for (int i=0;i<n;i++) if (!used[i] && (next<0 || p[i].arrival<p[next].arrival)) next=i;
            if (next<0) break;
            now=p[next].arrival;
            continue;
        }
        p[k].response=now-p[k].arrival; p[k].started=1;
        int start=now; now+=p[k].burst; add_segment(p[k].id,start,now); metrics(&p[k],now);
        used[k]=1; done++;
    }
}
static void round_robin(int n, int quantum) {
    int queue[MAX_QUEUE], head=0, tail=0, enqueued[MAX_PROCESSES]={0};
    sort_arrival(n);
    int done=0, now=0;
    while (done<n) {
        for (int i=0;i<n;i++) if (!enqueued[i] && p[i].arrival<=now) {
            if (tail >= MAX_QUEUE) { fprintf(stderr,"queue overflow\n"); exit(2); }
            queue[tail++]=i; enqueued[i]=1;
        }
        if (head==tail) {
            int next=-1; for (int i=0;i<n;i++) if (p[i].remaining>0 && (next<0 || p[i].arrival<p[next].arrival)) next=i;
            if (next<0) break;
            now=p[next].arrival;
            continue;
        }
        int k=queue[head++];
        if (!p[k].started) { p[k].response=now-p[k].arrival;p[k].started=1; }
        int run=p[k].remaining<quantum?p[k].remaining:quantum;
        int start=now;now+=run;p[k].remaining-=run;add_segment(p[k].id,start,now);
        for (int i=0;i<n;i++) if (!enqueued[i] && p[i].arrival<=now) {
            if (tail >= MAX_QUEUE) { fprintf(stderr,"queue overflow\n"); exit(2); }
            queue[tail++]=i; enqueued[i]=1;
        }
        if (p[k].remaining>0) { if (tail >= MAX_QUEUE) { fprintf(stderr,"queue overflow\n"); exit(2); } queue[tail++]=k; }
        else { metrics(&p[k],now);done++; }
    }
}
int main(void) {
    char algorithm[20]; int n, quantum=2;
    if (scanf("%19s",algorithm)!=1 || scanf("%d",&n)!=1 || n<1 || n>MAX_PROCESSES) return 2;
    if (!strcmp(algorithm,"RR") && (scanf("%d",&quantum)!=1 || quantum<1 || quantum>100000)) return 2;
    for (int i=0;i<n;i++) {
        if (scanf("%d,%d,%d,%d",&p[i].id,&p[i].arrival,&p[i].burst,&p[i].priority)!=4 || p[i].arrival<0 || p[i].burst<1 || p[i].priority<1 || p[i].priority>5) return 2;
        for(int j=0;j<i;j++) if(p[j].id==p[i].id) return 2;
        p[i].remaining=p[i].burst;
    }
    if (!strcmp(algorithm,"FCFS")) fcfs(n);
    else if (!strcmp(algorithm,"SJF")) non_preemptive(n,0);
    else if (!strcmp(algorithm,"PRIORITY")) non_preemptive(n,1);
    else if (!strcmp(algorithm,"RR")) round_robin(n,quantum);
    else return 2;

    double aw=0,at=0,ar=0; for(int i=0;i<n;i++){aw+=p[i].waiting;at+=p[i].turnaround;ar+=p[i].response;}
    printf("{\"algorithm\":\"%s\",\"timeQuantum\":%d,\"results\":[",algorithm,quantum);
    for(int i=0;i<n;i++){if(i)printf(",");printf("{\"id\":%d,\"completion_time\":%d,\"waiting_time\":%d,\"turnaround_time\":%d,\"response_time\":%d}",p[i].id,p[i].completion,p[i].waiting,p[i].turnaround,p[i].response);}
    printf("],\"schedule\":[");
    for(int i=0;i<segment_count;i++){if(i)printf(",");printf("{\"process\":%d,\"start\":%d,\"end\":%d}",timeline[i].id,timeline[i].start,timeline[i].end);}
    printf("],\"average_waiting_time\":%.2f,\"average_turnaround_time\":%.2f,\"average_response_time\":%.2f}\n",aw/n,at/n,ar/n);
    return 0;
}
