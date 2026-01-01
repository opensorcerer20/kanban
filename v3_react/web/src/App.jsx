import './styles.css';

import {
  useEffect,
  useState,
} from 'react';

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

import Column from './components/Column';

// credit: Kazuya-Oki dnd kit kanban board: https://codesandbox.io/p/sandbox/dnd-kit-kanban-board-1df69n

export default function App() {
  const [columns, setColumns] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [colsRes, cardsRes] = await Promise.all([
          fetch('/api/columns'),
          fetch('/api/cards'),
        ]);
        if (!colsRes.ok) throw new Error('Failed to load columns');
        if (!cardsRes.ok) throw new Error('Failed to load cards');
        const cols = await colsRes.json();
        const cards = await cardsRes.json();

        const byColumn = new Map(cols.map(c => [String(c.id), { id: String(c.id), title: c.title, cards: [] }]));
        cards.forEach(card => {
          const col = byColumn.get(String(card.columnId));
          if (col) {
            col.cards.push({ id: String(card.id), title: card.title || String(card.id), columnSortOrder: card.columnSortOrder ?? 0 });
          }
        });
        for (const col of byColumn.values()) {
          col.cards.sort((a, b) => (a.columnSortOrder ?? 0) - (b.columnSortOrder ?? 0));
          col.cards = col.cards.map(({ columnSortOrder, ...rest }) => rest);
        }
        if (!cancelled) setColumns(Array.from(byColumn.values()));
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const findColumn = (unique) => {
    if (!unique) {
      return null;
    }
    // overの対象がcolumnの場合があるためそのままidを返す
    if (columns.some((c) => c.id === unique)) {
      return columns.find((c) => c.id === unique) ?? null;
    }
    const id = String(unique);
    const itemWithColumnId = columns.flatMap((c) => {
      const columnId = c.id;
      return c.cards.map((i) => ({ itemId: i.id, columnId: columnId }));
    });
    const columnId = itemWithColumnId.find((i) => i.itemId === id)?.columnId;
    return columns.find((c) => c.id === columnId) ?? null;
  };

  const handleDragOver = (event) => {
    const { active, over, delta } = event;
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;
    const activeColumn = findColumn(activeId);
    const overColumn = findColumn(overId);
    if (!activeColumn || !overColumn || activeColumn === overColumn) {
      return null;
    }
    setColumns((prevState) => {
      const activeItems = activeColumn.cards;
      const overItems = overColumn.cards;
      const activeIndex = activeItems.findIndex((i) => i.id === activeId);
      const overIndex = overItems.findIndex((i) => i.id === overId);
      const newIndex = () => {
        const putOnBelowLastItem =
          overIndex === overItems.length - 1 && delta.y > 0;
        const modifier = putOnBelowLastItem ? 1 : 0;
        return overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      };
      return prevState.map((c) => {
        if (c.id === activeColumn.id) {
          c.cards = activeItems.filter((i) => i.id !== activeId);
          return c;
        } else if (c.id === overColumn.id) {
          c.cards = [
            ...overItems.slice(0, newIndex()),
            activeItems[activeIndex],
            ...overItems.slice(newIndex(), overItems.length)
          ];
          return c;
        } else {
          return c;
        }
      });
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;
    const activeColumn = findColumn(activeId);
    const overColumn = findColumn(overId);
    if (!activeColumn || !overColumn || activeColumn !== overColumn) {
      return null;
    }
    const activeIndex = activeColumn.cards.findIndex((i) => i.id === activeId);
    const overIndex = overColumn.cards.findIndex((i) => i.id === overId);
    if (activeIndex !== overIndex) {
      setColumns((prevState) => {
        return prevState.map((column) => {
          if (column.id === activeColumn.id) {
            column.cards = arrayMove(overColumn.cards, activeIndex, overIndex);
            return column;
          } else {
            return column;
          }
        });
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  return (
    // 今回は長くなってしまうためsensors、collisionDetectionなどに関しての説明は省きます。
    // ひとまずは一番使われていそうなものを置いています。
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div
        className="App"
        style={{ display: "flex", flexDirection: "row", padding: "20px" }}
      >
        {error && <div style={{ color: '#ff6b6b' }}>Error: {error}</div>}
        {columns.map((column) => (
          <Column
            key={column.id}
            id={column.id}
            title={column.title}
            cards={column.cards}
          ></Column>
        ))}
      </div>
    </DndContext>
  );
}
