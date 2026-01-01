export interface DateGroupedItem {
    id: string;
    updatedAt: string;
    [key: string]: any;
}

export interface DateGroup {
    label: string;
    items: DateGroupedItem[];
    isExpanded: boolean;
}

export function groupByDate<T extends DateGroupedItem>(items: T[]): DateGroup[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    const groups: { [key: string]: T[] } = {
        today: [],
        yesterday: [],
        thisWeek: [],
        thisMonth: [],
        older: [],
    };

    items.forEach((item) => {
        const itemDate = new Date(item.updatedAt);
        if (itemDate >= today) {
            groups.today.push(item);
        } else if (itemDate >= yesterday) {
            groups.yesterday.push(item);
        } else if (itemDate >= thisWeek) {
            groups.thisWeek.push(item);
        } else if (itemDate >= thisMonth) {
            groups.thisMonth.push(item);
        } else {
            groups.older.push(item);
        }
    });

    // Sort items within each group by updatedAt (newest first)
    Object.keys(groups).forEach((key) => {
        groups[key].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });

    return [
        { label: 'Today', items: groups.today, isExpanded: true },
        { label: 'Yesterday', items: groups.yesterday, isExpanded: true },
        { label: 'This Week', items: groups.thisWeek, isExpanded: true },
        { label: 'This Month', items: groups.thisMonth, isExpanded: false },
        { label: 'Older', items: groups.older, isExpanded: false },
    ].filter((group) => group.items.length > 0);
}

