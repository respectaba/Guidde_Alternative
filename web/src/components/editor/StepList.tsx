"use client";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Step } from "@guide/shared";

/** Reorderable, selectable list of step thumbnails. */
export function StepList({
  steps,
  activeIndex,
  onSelect,
  onReorder,
  onDelete,
}: {
  steps: Step[];
  activeIndex: number;
  onSelect: (i: number) => void;
  onReorder: (steps: Step[]) => void;
  onDelete: (i: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = steps.findIndex((s) => s.id === active.id);
    const to = steps.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(steps, from, to));
  };

  return (
    <div className="steplist">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {steps.map((step, i) => (
            <SortableStep
              key={step.id}
              step={step}
              index={i}
              active={i === activeIndex}
              onSelect={() => onSelect(i)}
              onDelete={() => onDelete(i)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableStep({
  step,
  index,
  active,
  onSelect,
  onDelete,
}: {
  step: Step;
  index: number;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`steplist-item ${active ? "active" : ""}`}
      onClick={onSelect}
    >
      <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        ⠿
      </span>
      <span className="step-num">{index + 1}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={step.screenshot} alt="" className="step-thumb" />
      <span className="step-cap">{step.caption || "Untitled step"}</span>
      <button
        className="step-del"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete step"
      >
        ✕
      </button>
    </div>
  );
}
