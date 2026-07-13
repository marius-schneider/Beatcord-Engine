import { expect, test } from "bun:test";

import { Semaphore } from "./semaphore";

test("runs up to `max` operations concurrently", async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const task = () =>
        sem.run(async () => {
            active++;
            peak = Math.max(peak, active);
            await Bun.sleep(20);
            active--;
        });

    await Promise.all([task(), task(), task(), task()]);
    expect(peak).toBe(2); // never more than 2 at once
    expect(active).toBe(0); // all released
});

test("queues work past the limit and drains it", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];
    const task = (n: number) =>
        sem.run(async () => {
            order.push(n);
            await Bun.sleep(5);
        });

    await Promise.all([task(1), task(2), task(3)]);
    expect(order).toEqual([1, 2, 3]); // serialized, FIFO
    expect(sem.pending).toBe(0);
    expect(sem.active).toBe(0);
});

test("releases the slot even when the task throws", async () => {
    const sem = new Semaphore(1);
    await expect(
        sem.run(async () => {
            throw new Error("boom");
        }),
    ).rejects.toThrow("boom");
    // Slot must be free again — a following task should run.
    const ran = await sem.run(async () => "ok");
    expect(ran).toBe("ok");
    expect(sem.active).toBe(0);
});

test("rejects an invalid max", () => {
    expect(() => new Semaphore(0)).toThrow();
});
