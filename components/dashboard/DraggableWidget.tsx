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
            editMode && "ring-2 ring-[#facc15]/50 rounded-xl bg-[#171c23]",
            className
        )}
    >
      {/* Drag Handle - Only Valid in Edit Mode */}
      {editMode && (
          <div 
            {...attributes} 
            {...listeners}
            className="absolute top-4 right-4 z-50 p-2 bg-[#090f15]/90 backdrop-blur-sm rounded-lg border border-[#30353d] text-[#d1c6ab] hover:text-[#facc15] hover:border-[#facc15] shadow-lg cursor-grab active:cursor-grabbing transition-colors"
          >
             <GripVertical className="w-4 h-4" />
          </div>
      )}
      
      {/* Render Content */}
      <div className={cn("h-full", editMode && "pointer-events-none")}>{children}</div>
    </div>
  );
}
