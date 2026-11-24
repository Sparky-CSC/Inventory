
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { GripVertical, Loader2, Save, RotateCcw } from 'lucide-react';

/**
 * SidebarCustomizer component allows users to reorder sidebar items via drag and drop.
 * It uses @hello-pangea/dnd for drag-and-drop capabilities.
 *
 * @param {object} props - The component props.
 * @param {Array<object>} props.defaultOrder - The default order of sidebar items. Each item object should have `name` and `icon`.
 * @param {Array<string>} props.userOrder - The user's custom order of sidebar item names.
 * @param {function(Array<string>): void} props.onSave - Callback function when the user saves the order. Receives the new order of item names.
 * @param {function(): void} props.onReset - Callback function when the user resets the order to default.
 * @param {boolean} props.isSaving - Indicates if the save operation is currently in progress.
 */
export default function SidebarCustomizer({ defaultOrder, userOrder, onSave, onReset, isSaving }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Initialize the items based on user order or default order
    if (userOrder && userOrder.length > 0) {
      const userOrderedItems = [];
      const remainingItems = [...defaultOrder];

      // Add items in user's preferred order
      userOrder.forEach(itemName => {
        const itemIndex = remainingItems.findIndex(item => item.name === itemName);
        if (itemIndex !== -1) {
          // If the item exists in the default list, add its full object to userOrderedItems
          userOrderedItems.push(remainingItems.splice(itemIndex, 1)[0]);
        }
      });

      // Add any remaining items from defaultOrder that were not in userOrder (e.g., new items)
      // These will be appended at the end of the user's custom order.
      setItems([...userOrderedItems, ...remainingItems]);
    } else {
      // Use default order if no custom order exists or userOrder is empty
      setItems([...defaultOrder]);
    }
  }, [defaultOrder, userOrder]);

  /**
   * Handles the end of a drag operation. Reorders the items in state.
   * @param {object} result - The drag end event object from DragDropContext.
   */
  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const reorderedItems = Array.from(items);
    const [movedItem] = reorderedItems.splice(source.index, 1);
    reorderedItems.splice(destination.index, 0, movedItem);

    setItems(reorderedItems);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-base-content/70">
        Drag and drop the items to reorder them in the sidebar. Your changes will be saved for your account only.
      </p>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sidebar-items">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {items.map((item, index) => (
                <Draggable key={item.name} draggableId={item.name} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex items-center p-3 rounded-lg border transition-shadow ${
                        snapshot.isDragging ? 'bg-base-300 shadow-lg' : 'bg-base-100 border-base-300'
                      }`}
                    >
                      <GripVertical className="w-5 h-5 mr-3 text-base-content/40" />
                      {item.icon && <item.icon className="w-5 h-5 mr-3" style={{ color: 'var(--color-primary)' }} />}
                      <span className="font-medium text-base-content">{item.name}</span>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="flex justify-end gap-2 pt-4 border-t border-base-300">
        <Button 
          variant="outline" 
          onClick={onReset} 
          disabled={isSaving}
          style={{
            borderColor: 'var(--color-base-300)',
            color: 'var(--color-base-content)',
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button 
          onClick={() => onSave(items.map(item => item.name))} 
          disabled={isSaving}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-content)',
            borderColor: 'var(--color-primary)',
          }}
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Order
        </Button>
      </div>
    </div>
  );
}
