# Plan: Improve Doc Section

## Analysis

### Current State
The Doc section is implemented across three main components:
- `src/components/docs/content-explorer.tsx` - Main container with scope dropdown, toolbar, and import handling
- `src/components/docs/content-tree.tsx` - Tree view container with folder modal handling and ScrollArea
- `src/components/docs/content-tree-item.tsx` - Individual tree node renderer (folder, doc, asset)

**Existing capabilities:**
- Tree structure with folders, docs, and assets
- Folder create/rename/delete via context menu
- External file import via drag-drop (ContentDropZone)
- AI inclusion/exclusion toggle per folder
- Expand/collapse with persisted state
- Context menus and dropdown menus for actions
- Assets open in default app via `open_file_with_default_app` Tauri command

**Missing capabilities (from task requirements):**
1. **Drag-and-drop for moving files into folders** - Only external imports work, no internal file/folder reorganization
2. **Reveal in Finder** - Can open assets in default app, but no way to reveal files/folders in Finder
3. **Local search/filter** - Only global search (Cmd+K), no filtering within the doc tree
4. **Standard file management features** - Copy path, duplicate, move via context menu

### Relevant Patterns
- **@dnd-kit**: Already used in kanban board (`src/components/tasks/kanban-board.tsx`) with `DndContext`, `DragOverlay`, `useSensors`
- **EntityFilterBar**: Reusable filter bar in `src/components/ui/entity-filter-bar.tsx` (dropdown-based)
- **moveDoc function**: Already exists in `src/lib/desk/content.ts:633` for moving docs between folders

### Key Files to Modify
| File | Changes |
|------|---------|
| `src/components/docs/content-tree.tsx` | Add DndContext wrapper, search input |
| `src/components/docs/content-tree-item.tsx` | Make items draggable/droppable, add menu items |
| `src/components/docs/content-explorer.tsx` | Wire up search state, move mutations |
| `src/stores/content.ts` | Add useMoveDoc hook (already exists, verify) |
| `src-tauri/src/lib.rs` | Add `reveal_in_finder` command |

---

## Plan

### Step 1: Add "Reveal in Finder" Tauri Command
**Files:** `src-tauri/src/lib.rs`

Add new Tauri command `reveal_in_finder` that:
- On macOS: `open -R <path>` (reveals and selects the file)
- On Windows: `explorer /select,<path>`
- On Linux: `xdg-open` on parent directory

Register in `invoke_handler`.

### Step 2: Add Reveal in Finder to Context Menus
**Files:** `src/components/docs/content-tree-item.tsx`

Add context menu items for docs, folders, and assets:
- "Reveal in Finder" (macOS) / "Show in Explorer" (Windows)
- Uses the new Tauri command via `invoke("reveal_in_finder", { path })`

### Step 3: Add Local Search/Filter to Content Tree
**Files:** `src/components/docs/content-tree.tsx`, `src/components/docs/content-explorer.tsx`

Add a search input to the ContentTree toolbar:
- Text input with search icon
- Filter nodes by title (docs) and name (folders)
- Recursive filtering: if a doc matches, show its parent folders
- Auto-expand matching folders
- Clear button when search is active
- Keyboard shortcut: Cmd+F focuses search when ContentExplorer is focused

Implementation approach:
- Add `searchQuery` state to ContentExplorer
- Pass to ContentTree as prop
- Filter `nodes` in ContentTree using a recursive function
- Auto-expand all folders when search is active

### Step 4: Add Drag-and-Drop for Files and Folders
**Files:** `src/components/docs/content-tree.tsx`, `src/components/docs/content-tree-item.tsx`

Implement @dnd-kit based drag-and-drop:

1. **ContentTree wrapper setup:**
   - Wrap tree in `DndContext` with sensors (PointerSensor with 8px activation distance)
   - Add `DragOverlay` for visual feedback
   - Handle `onDragStart`, `onDragOver`, `onDragEnd`

2. **Make items draggable:**
   - Use `useDraggable` on ContentTreeItem for docs (not folders initially - simpler)
   - Store dragged item reference for overlay

3. **Make folders droppable:**
   - Use `useDroppable` on folder ContentTreeItems
   - Visual highlight when hovering over valid drop target
   - Root area as droppable target (move to root)

4. **Drop handling:**
   - On drop: call `moveDoc` mutation
   - Optimistic UI update via query invalidation
   - Toast notification on success/error

5. **Visual feedback:**
   - Cursor changes during drag
   - Drop target highlight (border/background change)
   - DragOverlay shows item being dragged

### Step 5: Add "Move to Folder" Context Menu
**Files:** `src/components/docs/content-tree-item.tsx`, `src/components/docs/content-tree.tsx`

Add context menu option "Move to..." that opens a folder picker:
- Show submenu with folder list
- Include "Root" option to move to top level
- Alternative to drag-and-drop for accessibility

### Step 6: Add Additional File Management Features
**Files:** `src/components/docs/content-tree-item.tsx`, `src/lib/desk/content.ts`, `src/stores/content.ts`

Add to context menus:

**For Docs:**
- "Copy Path" - copies relative path to clipboard
- "Duplicate" - creates a copy with "(copy)" suffix

**For Folders:**
- "Copy Path" - copies folder path

**For Assets:**
- "Copy Path" - copies file path

Implementation:
- Add `duplicateDoc` function to content.ts
- Add `useDuplicateDoc` hook to content store
- Use `navigator.clipboard.writeText()` for copy path

### Step 7: Add Keyboard Shortcuts
**Files:** `src/components/docs/content-tree.tsx`

Add keyboard navigation:
- `Cmd+F` - Focus search input
- `Escape` - Clear search, blur input
- Arrow keys - Navigate tree (optional, lower priority)

---

## Risks

1. **Drag-and-drop complexity**: @dnd-kit with tree structures requires careful handling of nested droppables. May need `closestCenter` instead of `closestCorners` collision detection.

2. **Performance with large trees**: Filtering and drag-drop calculations could slow down with 100+ files. Consider debouncing search input.

3. **Cross-platform commands**: The reveal-in-finder command needs testing on Windows/Linux. macOS is primary target.

4. **State sync after move**: Moving files requires proper query invalidation to update both source and destination folder trees. The existing `moveDoc` mutation handles this.

5. **Search with nested folders**: The recursive filter function needs to preserve folder structure while hiding non-matching items. This is complex but solvable.

6. **Drag-drop and context menus**: Right-click during drag could cause issues. May need to prevent context menu while dragging.

---

## Implementation Order

1. **Reveal in Finder** (Steps 1-2) - Quick win, standalone feature
2. **Local Search** (Step 3) - High value, independent of drag-drop
3. **Drag-and-Drop** (Steps 4-5) - Most complex, core improvement
4. **Additional Features** (Step 6) - Polish items
5. **Keyboard Shortcuts** (Step 7) - Refinement

Each step can be committed independently after verification.
