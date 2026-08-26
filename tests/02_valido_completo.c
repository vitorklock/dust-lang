#include <stdio.h>

int main(void) {
    int base = 0;
    base = (2 + (3 * 4));
    int grouped = ((2 + 3) * 4);
    float charge = 10.5f;
    int running = 1;
    printf("%s\n", "How many ticks?");
    scanf("%d", &base);
    while ((base > 0)) {
        printf("%d\n", base);
        charge = (charge + (2 * 1.5f));
        base = (base - 1);
    }
    if ((charge >= 15)) {
        printf("%s\n", "Fully powered!");
        printf("%d\n", grouped);
    } else {
        printf("%s\n", "Not enough signal.");
    }
    if (running) {
        printf("%s\n", "Circuit still on.");
    }
    int stopped = (!running);
    if ((!stopped)) {
        printf("%s\n", "Inverter works.");
    }
    return 0;
}
