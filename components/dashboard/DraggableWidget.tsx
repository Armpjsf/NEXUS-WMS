import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  editMode?: boolean;
}

export function DraggableWidget({ id, children, className, editMode = false }: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
            "relative group h-full", 
            editMode && "ring-2 ring-emerald-500/50 rounded-[22px]",
            className
        )}
    >
      {/* Drag Handle - Only Valid in Edit Mode */}
      {editMode && (
          <div 
            {...attributes} 
            {...listeners}
            className="absolute top-4 right-4 z-50 p-2 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-300 shadow-md cursor-grab active:cursor-grabbing transition-colors"
          >
             <GripVertical className="w-4 h-4" />
          </div>
      )}
      
      {/* Render Content */}
      <div className={cn("h-full", editMode && "pointer-events-none")}>{children}</div>
    </div>
  );
}
