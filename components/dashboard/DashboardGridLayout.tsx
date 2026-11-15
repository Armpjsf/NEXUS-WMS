import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy 
} from '@dnd-kit/sortable';
import { DraggableWidget } from './DraggableWidget';
import { Settings2, Save } from 'lucide-react';

interface DashboardGridProps {
  widgets: Record<string, React.ReactNode>;
  defaultLayout: string[];
  storageKey?: string;
}

export function DashboardGridLayout({ widgets, defaultLayout, storageKey = 'dashboard_layout_v1' }: DashboardGridProps) {
  const [items, setItems] = useState(defaultLayout);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load from API (Priority) -> LocalStorage (Fallback)
  useEffect(() => {
      async function loadLayout() {
          try {
              // 1. Try API
              const res = await fetch(`/api/user/config?key=${storageKey}`);
              if (res.ok) {
                  const json = await res.json();
                  if (json.value) {
                      console.log("Loaded layout from cloud");
                      const parsed = json.value;
                      // Validate keys
                      const validKeys = parsed.filter((k: string) => Object.keys(widgets).includes(k));
                      const newKeys = defaultLayout.filter(k => !validKeys.includes(k));
                      setItems([...validKeys, ...newKeys]);
                      return;
                  }
              }
          } catch (e) {
              console.warn("Cloud sync failed, falling back to local", e);
          }

          // 2. Fallback to LocalStorage
          const saved = localStorage.getItem(storageKey);
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  const validKeys = parsed.filter((k: string) => Object.keys(widgets).includes(k));
                  const newKeys = defaultLayout.filter(k => !validKeys.includes(k));
                  setItems([...validKeys, ...newKeys]);
              } catch (e) {
                  console.error("Failed to parse local layout", e);
              }
          }
      }
      loadLayout();
  }, [widgets, defaultLayout, storageKey]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over?.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
      setHasChanges(true);
      setSyncStatus('idle');
    }
  };

  const saveLayout = async () => {
      // Optimsitic Update (Local)
      localStorage.setItem(storageKey, JSON.stringify(items));
      setSyncStatus('saving');
      
      try {
          await fetch('/api/user/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: storageKey, value: items })
          });
          setSyncStatus('saved');
          setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (e) {
          console.error("Failed to sync layout to cloud", e);
          setSyncStatus('error');
      }

      setHasChanges(false);
      setIsEditing(false);
  };

  const resetLayout = () => {
      if (confirm("Reset to default layout?")) {
        setItems(defaultLayout);
        localStorage.removeItem(storageKey);
        // Also clear cloud?
        setHasChanges(true); // Flag as changed so user hits save? Or auto-save?
        // Let's auto-save the reset
        fetch('/api/user/config', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ key: storageKey, value: defaultLayout })
        });
      }
  };

  return (
    <div className="space-y-4">
       {/* Toolbar */}
       <div className="flex justify-end gap-2 mb-4 items-center">
           {syncStatus === 'saving' && <span className="text-xs text-[#8a92a6] font-mono animate-pulse">Saving to cloud...</span>}
           {syncStatus === 'saved' && <span className="text-xs text-[#57ec7f] font-mono font-bold">Cloud Synced</span>}
           {syncStatus === 'error' && <span className="text-xs text-[#ff5449] font-mono font-bold">Sync Failed</span>}
           
           {isEditing ? (
               <>
                 <button onClick={resetLayout} className="text-xs font-mono text-[#8a92a6] hover:text-[#ffb4ab] font-bold px-3 py-1.5 transition-colors">
                    Reset
                 </button>
                 <button 
                    onClick={saveLayout}
                    className="flex items-center gap-2 bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-md"
                 >
                    <Save className="w-3.5 h-3.5" /> Save Layout
                 </button>
               </>
           ) : (
               <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 bg-[#171c23] hover:bg-[#252a32] text-[#d1c6ab] hover:text-[#facc15] border border-[#30353d] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all"
               >
                  <Settings2 className="w-3.5 h-3.5 text-[#facc15]" /> Customize Layout
               </button>
           )}
       </div>

       <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
       >
         <SortableContext items={items} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                {items.map((id) => {
                    const widget = widgets[id];
                    if (!widget) return null;
                    
                    // Determine Span based on ID (Hardcoded logic for layout beauty)
                    // In a real app, span would be config state too.
                    let span = "col-span-1 md:col-span-1"; // Default small

                    if (id === 'kpi_grid') span = "col-span-full"; 
                    if (id === 'chart_top_sellers') span = "col-span-full lg:col-span-4";
                    if (id === 'chart_inventory_health') span = "col-span-full lg:col-span-2";
                    if (id === 'chart_sales_category') span = "col-span-full lg:col-span-3";
                    if (id === 'chart_weekly_activity') span = "col-span-full lg:col-span-3";
                    if (id === 'table_low_stock') span = "col-span-full lg:col-span-3";
                    if (id === 'table_recent_activity') span = "col-span-full lg:col-span-3";
                    
                    return (
                        <div key={id} className={span}>
                             <DraggableWidget id={id} editMode={isEditing}>
                                 {widget}
                             </DraggableWidget>
                        </div>
                    );
                })}
            </div>
         </SortableContext>
       </DndContext>
    </div>
  );
}
