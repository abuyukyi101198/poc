import curses
import random

statuses = [
    "Testing", "Releasing", "Deploying", "Deployed", "Ready",
    "Failed commissioning", "Commissioning", "New"
]

zones = ["default", "zone-1", "zone-2", "zone-3"]
fabrics = [f"fabric-{i}" for i in range(1, 6)]
tags_pool = [f"mlod2s{str(i).zfill(3)}" for i in range(1, 21)]
ram_choices = [2, 3, 4, 5, 6, 7, 9, 10]

def generate_machines(num):
    dummy_machines = []
    for i in range(num):  # generate 45 machines
        fdqn = f"sin73l{str(45 + i).zfill(5)}.maas"
        status = random.choice(statuses)
        tags = random.sample(tags_pool, random.randint(0, 3))
        zone = random.choice(zones)
        fabric = random.choice(fabrics)
        cores = random.choice([2, 4, 6, 8, 12, 16, 24, 32])
        ram = random.choice(ram_choices)
        disks = random.randint(5, 9)
        storage = round(random.uniform(0.5, 50.0), 2)

        dummy_machines.append({
            "FDQN": fdqn,
            "STATUS": status,
            "TAGS": tags,
            "ZONE": zone,
            "FABRIC": fabric,
            "CORES": cores,
            "RAM": ram,
            "DISKS": disks,
            "STORAGE": storage
        })
    reversed_statuses = list(reversed(statuses))
    status_priority = {status: i for i, status in enumerate(reversed_statuses)}

    dummy_machines.sort(key=lambda m: status_priority.get(m["STATUS"], len(statuses)))
    return dummy_machines

def draw_machine_table(stdscr, machines, start_line=0, max_rows=None):
    height, width = stdscr.getmaxyx()
    if max_rows is None:
        max_rows = height - start_line - 2

    headers = ["FDQN", "STATUS", "TAGS", "ZONE", "FABRIC", "CORES", "RAM", "DISKS", "STORAGE"]
    col_widths = [20, 24, 35, 11, 12, 9, 9, 9, 11]
    numeric_columns = {"CORES", "RAM", "DISKS", "STORAGE"}

    curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_WHITE)

    # Draw header per column with individual white bg block
    x = 0
    stdscr.attron(curses.color_pair(1))
    for header, w in zip(headers, col_widths):
        if header in numeric_columns:
            # Right align numeric headers
            stdscr.addstr(start_line, x, f"{header:>{w}}"[:w])
        else:
            # Left align string headers
            stdscr.addstr(start_line, x, f"{header:<{w}}"[:w])
        x += w
    stdscr.attroff(curses.color_pair(1))

    # Draw divider
    stdscr.addstr(start_line + 1, 0, "-" * min(width, sum(col_widths)))

    # Draw rows
    for i, machine in enumerate(machines[:max_rows]):
        line = start_line + 2 + i
        if line >= height:
            break
        values = [
            machine["FDQN"],
            machine["STATUS"],
            (", ".join(machine["TAGS"]) if machine["TAGS"] else "-")[:col_widths[2]],
            machine["ZONE"],
            machine["FABRIC"],
            machine["CORES"],
            f"{machine['RAM']}GiB",
            machine["DISKS"],
            f"{machine['STORAGE']:.2f}TB"
        ]
        row = ""
        for header, val, w in zip(headers, values, col_widths):
            if header in numeric_columns:
                row += f"{str(val):>{w}}"
            else:
                row += f"{str(val):<{w}}"
        stdscr.addstr(line, 0, row[:width - 1])


def main(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(False)
    stdscr.keypad(True)

    machines = generate_machines(10)

    while True:
        stdscr.clear()
        stdscr.addstr(0, 0, "📋 Machine Table View (Press ESC or Q to exit)")
        draw_machine_table(stdscr, machines, start_line=2)
        stdscr.refresh()

        key = stdscr.getch()
        if key in (27, ord('q'), ord('Q')):
            break

curses.wrapper(main)