# Execution Summary: Improve Doc Section

## Changes

### 1. Tauri Backend (`src-tauri/src/lib.rs`)
- Added `reveal_in_finder` command that reveals files/folders in the system file manager:
  - macOS: Uses `open -R <path>` to reveal and select the file
  - Windows: Uses `explorer /select,<path>`
  - Linux: Opens parent directory with `xdg-open`
- Registered the new command in `invoke_handler`

### 2. Content Tree Item (`src/components/docs/content-tree-item.tsx`)
- **New imports**: `useDraggable`, `useDroppable` from `@dnd-kit/core`, `FolderInput`, `Copy` icons
- **New helper functions**:
  - `revealInFinder(path)` - Invokes Tauri command to reveal in Finder
  - `copyPath(path)` - Copies path to clipboard with toast notification
- **New props**: `isDraggable`, `dropTargetPath`, `allFolderPaths`, `onMoveDocToFolder`, `basePath`
- **Folder enhancements**:
  - Added `useDroppable` hook for folders to accept dropped docs
  - Visual highlight when folder is a drop target (ring-2 ring-primary)
  - Added "Reveal in Finder" and "Copy Path" to context and dropdown menus
- **Doc enhancements**:
  - Added `useDraggable` hook for docs (when `isDraggable` is true)
  - Visual opacity change when dragging (0.5)
  - Added "Move to..." submenu in context/dropdown menus with folder list
  - Added "Reveal in Finder" and "Copy Path" to context and dropdown menus
- **Asset enhancements**:
  - Added "Reveal in Finder" and "Copy Path" to context and dropdown menus

### 3. Content Tree (`src/components/docs/content-tree.tsx`)
- **New imports**: `DndContext`, `DragOverlay`, `PointerSensor`, `useSensor`, `useSensors`, `Search`, `X` icons
- **New helper functions**:
  - `filterNodes(nodes, query)` - Recursively filters tree nodes by search query
  - `getAllFolderPaths(nodes)` - Extracts all folder paths for auto-expand
- **Search functionality**:
  - Added search input in toolbar with debounced filtering
  - Auto-expands matching folders during search
  - Restores previous expansion state when search clears
  - Clear button and Escape key support
- **Drag and drop**:
  - Wrapped tree in `DndContext` with `PointerSensor` (8px activation distance)
  - Added `DragOverlay` showing doc title while dragging
  - Drag state management (`activeDoc`, `dropTargetPath`)
  - Handlers for `onDragStart`, `onDragOver`, `onDragEnd`, `onDragCancel`
- **New props**: `onMoveDoc`, `allFolderPaths`

### 4. Content Explorer (`src/components/docs/content-explorer.tsx`)
- **New imports**: `useMoveDoc`, `getDocsPath`, `isTauri`, `useEffect`
- **basePath computation**: Computes the docs directory path for "Reveal in Finder" functionality
- **New mutation**: `useMoveDoc` for moving docs between folders
- **New handler**: `handleMoveDoc(docId, fromPath, toPath)` for drag-drop and menu moves
- **New props passed to ContentTree**: `onMoveDoc`, `allFolderPaths`, `basePath`

### 5. Context Menu UI (`src/components/ui/context-menu.tsx`)
- Added missing submenu components:
  - `ContextMenuSub`
  - `ContextMenuSubTrigger`
  - `ContextMenuSubContent`

## Testing

### Build Verification
- Ran `npm run build` successfully with no TypeScript or compilation errors

### Features Implemented
1. **Reveal in Finder**: Available in context menus for docs, folders, and assets (macOS/Windows/Linux)
2. **Copy Path**: Copies file/folder path to clipboard with toast confirmation
3. **Local Search**:
   - Search input in toolbar filters docs, folders, assets by name
   - Auto-expands folders containing matches
   - Clear button and Escape key support
4. **Drag and Drop**:
   - Docs can be dragged onto folders
   - Visual feedback: dragged item opacity, drop target highlight
   - `DragOverlay` shows doc title while dragging
5. **Move to Menu**:
   - Context menu submenu lists all folders
   - "Root" option to move to top level
   - Toast notification on successful move

### Manual Testing Needed
- Test drag and drop behavior in Tauri (real file system)
- Verify Reveal in Finder works on macOS
- Test search with various folder depths
- Test move operations between folders
